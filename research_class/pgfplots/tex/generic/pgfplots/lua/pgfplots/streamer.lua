-- Contains coordinate streamers, i.e. classes which generate coordinates and stream them to some output stream

local math=math
local pgfplotsmath = pgfplots.pgfplotsmath
local type=type
local tostring=tostring
local error=error
local table=table

do
-- all globals will be read from/defined in pgfplots:
local _ENV = pgfplots
-----------------------------------

CoordOutputStream = newClass()

function CoordOutputStream:constructor()
end

-- @param pt an instance of Coord
function CoordOutputStream:coord(pt)
end

-----------------------------------

SurveyCoordOutputStream = newClassExtends(CoordOutputStream)

function SurveyCoordOutputStream:constructor(targetPlothandler)
	if not targetPlothandler then error("arguments must not be nil") end
	self.plothandler=  targetPlothandler
end

function SurveyCoordOutputStream:coord(pt)
	self.plothandler:surveypoint(pt)
end

-------------
-- This is a partial reimplementation of \addplot expression: it samples points -- but entirely in LUA. Only the results are serialized back to TeX.

AddplotExpressionCoordinateGenerator = newClass()

function AddplotExpressionCoordinateGenerator:constructor(coordoutputstream, expressionsByDimension, domainMin, domainMax, samples, variableNames)
	if not coordoutputstream or not expressionsByDimension or not domainMin or not domainMax or not samples or not variableNames then error("arguments must not be nil") end
	if #variableNames ~= 2 then error("Expected 2 variableNames") end
	self.coordoutputstream = coordoutputstream
	self.is3d = #expressionsByDimension == 3
	self.expressions = expressionsByDimension
	self.domainMin = domainMin
	self.domainMax = domainMax
	self.samples = samples
	self.variableNames = variableNames
	
	-- log("initialized " .. tostring(self) .. "\n")
end

-- @return true on success or false if the operation cannot be carried out.
-- this method is a replicate of \pgfplots@addplotimpl@expression@@
function AddplotExpressionCoordinateGenerator:generateCoords()
	local stringToFunctionMap = pgfluamathfunctions.stringToFunctionMap
	-- create a backup of the 'x' and 'y' math expressions which 
	-- have been defined in \pgfplots@coord@stream@start:
	local old_global_function_x = stringToFunctionMap["x"]
	local old_global_function_y = stringToFunctionMap["y"]

	local coordoutputstream = self.coordoutputstream
	local is3d = self.is3d
	local expressions = self.expressions
	local xExpr = expressions[1]
	local yExpr = expressions[2]
	local zExpr = expressions[3]

	local domainMin = self.domainMin
	local domainMax = self.domainMax
	local samples = self.samples
	local h = {}
	for i = 1,#domainMin do
		h[i] = (domainMax[i] - domainMin[i]) / (samples[i]-1)
	end

	local variableNames = self.variableNames
	
	local x,y
	local sampleLine = #samples==1
	
	local function pseudoconstantx() return x end
	local pseudoconstanty
	if sampleLine then
		if yExpr ~= variableNames[2] then
			-- suppress the warning - we want to allow (x,y,x^2) in this case.
			pseudoconstanty = function() return 0 end
		else
			local didWarn = false
			pseudoconstanty = function()
				if not didWarn then
					log("Sorry, you can't use 'y' in this context. PGFPlots expected to sample a line, not a mesh. Please use the [mesh] option combined with [samples y>0] and [domain y!=0:0] to indicate a twodimensional input domain\n")
					didWarn = true
				end
				return 0
			end
		end
	else
		pseudoconstanty = function() return y end
	end

	local pgfmathparse = pgfluamathparser.pgfmathparse
	local prepareX
	if xExpr == variableNames[1] then
		prepareX = function() return x end
	else
		prepareX = function() return pgfmathparse(xExpr) end
	end

	local prepareY
	if yExpr == variableNames[2] then
		prepareY = function() return y end
	else
		prepareY = function() return pgfmathparse(yExpr) end
	end

	local function computeXYZ()
		stringToFunctionMap[variableNames[1]] = pseudoconstantx
		stringToFunctionMap[variableNames[2]] = pseudoconstanty
		local X = prepareX()
		local Y = prepareY()
		local Z = nil
		if is3d then
			Z = pgfmathparse(zExpr)
		end
		
		local pt = Coord.new()
		pt.x = { X, Y, Z}

		-- restore 'x' and 'y'
		-- FIXME : defining the resulting x/y coordinates as 'x' and 'y' constants was a really really bad idea in the first place :-(
		stringToFunctionMap["x"] = old_global_function_x
		stringToFunctionMap["y"] = old_global_function_y

		coordoutputstream:coord(pt)
	end
	
	if not sampleLine then
		local xmin = domainMin[1]
		local ymin = domainMin[2]
		local hx = h[1]
		local hy = h[2]
		local max_i = samples[1]-1
		local max_j = samples[2]-1
		-- samples twodimensionally (a lattice):
		for j = 0,max_j do
			-- FIXME : pgfplots@plot@data@notify@next@y
			y = ymin + j*hy
			-- log("" .. j .. "\n")
			for i = 0,max_i do
				-- FIXME : pgfplots@plot@data@notify@next@x
				x = xmin + i*hx
				computeXYZ()
			end
			-- FIXME : \pgfplotsplothandlernotifyscanlinecomplete
		end
	else
		local xmin = domainMin[1]
		local hx = h[1]
		local max_i = samples[1]-1
		for i = 0,max_i do
			-- FIXME : pgfplots@plot@data@notify@next@x
			x = xmin + i*hx
			computeXYZ()
		end
	end
	
	stringToFunctionMap[variableNames[1]] = nil
	stringToFunctionMap[variableNames[2]] = nil
	return true
end

function AddplotExpressionCoordinateGenerator:__tostring()
	local result = "AddplotExpressionCoordinateGenerator[\n"
	result = result .. "\n  variable(s)=" .. self.variableNames[1] .. " " .. self.variableNames[2]
	result = result .. "\n  expressions="
	for i = 1,#self.expressions do
		result = result .. self.expressions[i] ..", "
	end
	result = result .. "\n  domain=" .. self.domainMin[1] .. ":" .. self.domainMax[1]
	result = result .. "\n  samples=" .. self.samples[1] 
	if #self.domainMin == 2 then
		result = result .. "\n  domain y=" .. self.domainMin[2] .. ":" .. self.domainMax[2]
		result = result .. "\n  samples y=" .. self.samples[2] 
	end
	result = result .. "]"
	return result
end

end
