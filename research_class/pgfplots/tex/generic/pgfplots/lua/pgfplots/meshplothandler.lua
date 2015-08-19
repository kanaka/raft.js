-- This file has dependencies to BOTH, the TeX part of pgfplots and the LUA part.
-- It is the only LUA component with this property.
--
-- Its purpose is to encapsulate the communication between TeX and LUA in a central LUA file

local pgfplotsmath = pgfplots.pgfplotsmath
local error=error
local table=table
local string=string
local tostring=tostring
local type=type
local io=io

do
-- all globals will be read from/defined in pgfplots:
local _ENV = pgfplots


-------------------------------------------------------
-- A patch type.
-- @see \pgfplotsdeclarepatchclass

PatchType = newClass()

function PatchType:constructor(name, numVertices)
	self.name = name
	self.numVertices = numVertices
end

function PatchType:__tostring()
	return self.name
end

function PatchType:newPatch(coords)
	return Patch.new(self,coords)
end

LinePatchType = newClassExtends(PatchType)

function LinePatchType:constructor()
	PatchType.constructor(self, "line", 2)
end

TrianglePatchType = newClassExtends(PatchType)

function TrianglePatchType:constructor()
	PatchType.constructor(self, "triangle", 3)
end


RectanglePatchType = newClassExtends(PatchType)

function RectanglePatchType:constructor()
	PatchType.constructor(self, "rectangle", 4)
end

-------------------------------------------------------
--
-- a single patch.
-- @see \pgfplotsdeclarepatchclass

Patch = newClass()

function Patch:constructor(patchtype, coords)
	if not patchtype or not coords then error("arguments must not be nil") end
	if #coords ~= patchtype.numVertices then error("Unexpected number of coordinates provided; expected " .. tostring(patchtype.numVertices) .. " but got " .. tostring(#coords)) end

	self.patchtype = patchtype
	self.coords = coords
end

-------------------------------------------------------
-- Replicates \pgfplotsplothandlermesh (to some extend)
MeshPlothandler = newClassExtends(Plothandler)

function MeshPlothandler:constructor(axis, pointmetainputhandler)
    Plothandler.constructor(self,"mesh", axis, pointmetainputhandler)
end

-- see \pgfplot@apply@zbuffer
function MeshPlothandler:reverseScanline(scanLineLength)
    local coords = self.coords
    local tmp
    local scanlineOff
    local numScanLines = #coords / scanLineLength
    for scanline = 0,numScanLines-1,1 do
        scanlineOff = scanline * scanLineLength
        local reverseindex = scanlineOff + scanLineLength
        for i = 0,scanLineLength/2-1,1 do
            tmp = coords[1+scanlineOff+i]
            coords[1+scanlineOff+i] = coords[reverseindex]
            coords[reverseindex] = tmp
            
            reverseindex = reverseindex-1
        end
    end
end

-- see \pgfplot@apply@zbuffer
function MeshPlothandler:reverseTransposed(scanLineLength)
    local coords = self.coords
    local tmp
    local scanlineOff
    local numScanLines = #coords / scanLineLength
    local reverseScanline = numScanLines-1
    for scanline = 0,numScanLines/2-1,1 do
        scanlineOff = 1+scanline * scanLineLength
        reverseScanlineOff = 1+reverseScanline * scanLineLength
        for i = 0,scanLineLength-1 do
            tmp = coords[scanlineOff+i]
            coords[scanlineOff+i] = coords[reverseScanlineOff+i]
            coords[reverseScanlineOff+i] = tmp
        end

        reverseScanline = reverseScanline-1
    end
end

-- see \pgfplot@apply@zbuffer
function MeshPlothandler:reverseStream()
    local coords = self.coords
    local tmp
    local reverseindex = #coords
    for i = 1,#coords/2 do
        tmp = coords[i]
        coords[i] = coords[reverseindex]
        coords[reverseindex] = tmp
        reverseindex = reverseindex-1
    end
end



-------------------------------------------------------
--
-- The (LUA!) visualizer for patch plots. It prepares stuff such that TeX only needs to work with lowlevel driver (PGF) streams.
--

MeshVisualizer = newClassExtends(PlotVisualizer)

local COORDINATE_VALUE_OF_JUMPS = -16000
local meshVisualizerTagEmptyCoordinates = function(pt)
	pt.pgfXY= { COORDINATE_VALUE_OF_JUMPS, COORDINATE_VALUE_OF_JUMPS }
	pt.x = { COORDINATE_VALUE_OF_JUMPS, COORDINATE_VALUE_OF_JUMPS, COORDINATE_VALUE_OF_JUMPS }
end

function MeshVisualizer:constructor(sourcePlotHandler, patchType, rows, cols, isXVariesOrdering, isMatrixInput, isMatrixOutput, isZBufferSort)
	PlotVisualizer.constructor(self,sourcePlotHandler)
	self.patchType = patchType
	self.isMatrixInput = isMatrixInput
	self.isMatrixOutput = isMatrixOutput
	self.isZBufferSort = isZBufferSort
	self.rows = rows
	self.cols = cols
	self.isXVariesOrdering =isXVariesOrdering

	self.isOneDimMode= false
	self.scanLineLength =-1
	if isMatrixInput then
		-- isOneDimMode is ONLY interesting for matrix input
		if cols <= 1 or rows <=1 then
			self.isOneDimMode = true
			self.patchType = LinePatchType.new()
			-- this is not yet implemented (and cannot happen since the TeX call does catch this)
			error("UNSUPPORTED OPERATION EXCEPTION")
		end

		if isXVariesOrdering then
			-- x varies (=rowwise)
			self.scanLineLength = cols
		else
			-- y varies (=colwise)
			self.scanLineLength = rows
		end

		self.notifyJump = meshVisualizerTagEmptyCoordinates
	else
		-- disable any special handling
		self.isXVariesOrdering = true
	end

	-- log("initialized MeshVisualizer with " .. tostring(sourcePlotHandler) .. ", " .. tostring(patchType) .. ", isMatrixInput = " .. tostring(isMatrixInput) .. ", isMatrixOutput = " .. tostring(isMatrixOutput) .. ", isZBufferSort = " .. tostring(isZBufferSort) .. " rows = " ..tostring(rows) .. " cols = " ..tostring(cols) .. " is x varies=" .. tostring(isXVariesOrdering))
end

function MeshVisualizer:getVisualizationOutput()
	local result = PlotVisualizer.getVisualizationOutput(self)

	if self.isMatrixInput and not self.isMatrixOutput then
		result = self:decodeIntoPatches(result)
	end

	if self.isZBufferSort then
		result = self:applyZBufferSort(result)
	end
	
	return result
end

-- @param coords an array of Coord
function MeshVisualizer:applyZBufferSort(coords)
	-- in order to sort this thing, we need to compute the sort key (view depth) for each coord.
	-- furthermore, each list entry must be single patch... that means we need a (huge?) temporary table.
	
	local patchType = self.patchType
	local numVertices = patchType.numVertices

	if (#coords % numVertices) ~= 0 then error("Got an unexpected number of input coordinates: each patch has " .. tostring(numVertices) .. " vertices, but the number of coords " .. tostring(#coords) .. " is no multiple of this number") end
	local numPatches = #coords / numVertices

	-- STEP 1: compute an array of patches.
	local patches = {}
	local off=1
	for i = 1,numPatches do
		local patchCoords = {}
		for j = 1,numVertices do
			local pt = coords[off]
			off = off+1
			patchCoords[j] = pt
		end
		local patch = patchType:newPatch(patchCoords)
		patches[i] = patch
	end
	if off ~= 1+#coords then error("Internal error: not all coordinates are part of patches (got " .. tostring(off) .. "/" .. tostring(#coords) ..")") end

	-- STEP 2: assign the sort key: the "element depth".
	--
	-- the "element depth" is defined to be the MEAN of all
	-- vertex depths. 
	-- And since the mean is 1/n * sum_{i=1}^n V_i, we can
	-- directly omit the 1/n --- it is the same for every
	-- vertex anyway, and we only want to compare the depth
	-- values.
	local axis = self.axis
	local getVertexDepth = axis.getVertexDepth
	for i=1,numPatches do
		local patch = patches[i]
		local patchcoords = patch.coords

		local sumOfVertexDepth = 0
		for j = 1,numVertices do
			local vertex = patchcoords[j]

			local vertexDepth = getVertexDepth(axis,vertex)
			
			sumOfVertexDepth = sumOfVertexDepth + vertexDepth
		end
		patch.elementDepth = sumOfVertexDepth
	end

	-- STEP 3: SORT.
	local comparator = function(patchA, patchB)
		return patchA.elementDepth > patchB.elementDepth
	end
	table.sort(patches, comparator)

	-- STEP 4: convert back into a list (in-place).
	local off = 1
	for i=1,numPatches do
		local patch = patches[i]
		local patchcoords = patch.coords
		for j = 1,numVertices do
			coords[off] = patchcoords[j]
			off = off+1
		end
	end
	if off ~= 1+#coords then error("Internal error: not all coordinates are part of patches (got " .. tostring(off) .. "/" .. tostring(#coords) ..")") end

	return coords
end

function MeshVisualizer:decodeIntoPatches(coords)
	local result = {}
	
	local scanLineLength = self.scanLineLength
	local length = #coords

	local i = scanLineLength
	while i < length do
		local im = i-scanLineLength

		for j = 2,scanLineLength do
			table.insert(result, coords[im+j-1]) -- (i-1,j-1)
			table.insert(result, coords[im+j])   -- (i-1,j  )
			table.insert(result, coords[i+j])    -- (i  ,j  )
			table.insert(result, coords[i+j-1])  -- (i  ,j-1)
		end

		i = i + scanLineLength
	end

	return result
end

end
