--
-- This file contains parts of pgfplotscolormap.code.tex
--

local math=math
local pgfplotsmath = pgfplots.pgfplotsmath
local io=io
local type=type
local tostring=tostring
local error=error
local table=table

do
-- all globals will be read from/defined in pgfplots:
local _ENV = pgfplots
-----------------------------------

ColorSpace = newClass()
function ColorSpace:constructor(numComponents)
	self.numComponents=numComponents
end

rgb = ColorSpace.new(3)
cmyk = ColorSpace.new(4)
gray = ColorSpace.new(1)


ColorMap = newClass()

ColorMap.range =1000

-- h: mesh width between adjacent values
-- colorspace: an instance of ColorSpace
-- values: an array (1-based table) with color components. Each color component is supposed to be a table with K entries where K is colorspace:numComponents
function ColorMap:constructor( h, colorspace, values)
	if not h or not colorspace or not values then error("arguments must not be nil")end

	self.name = name
	self.h = h
	self.invh = 1/h
	self.colorspace = colorspace
	self.values = values

	local numComponents = self.colorspace.numComponents
	for i = 1,#self.values do
		local value = self.values[i]
		if #value ~= numComponents then
			error("Some value has an unexpected number of color components, expected " .. self.colorspace.numComponents .. " but was ".. #value);
		end
	end
end

function ColorMap:findPrecomputed(inMin, inMax, x)
	local transformed
	if inMin == 0 and inMax == ColorMap.range then
		transformed = x
	else
		local scale = ColorMap.range / (inMax - inMin) 

		transformed = (x - inMin) * scale
	end
	transformed = math.max(0, transformed)
	transformed = math.min(ColorMap.range, transformed)
	
	local divh = transformed * self.invh
	local intervalno = math.floor(divh)
	local factor = divh - intervalno
	local factor_two = 1-factor

	
	-- Step 2: interpolate the desired RGB value using vector valued interpolation on the identified interval
	if intervalno+1 == #self.values then
		-- ah- we are at the right end!
		return self.values[#self.values]
	end

	local left = self.values[intervalno+1]
	local right = self.values[intervalno+2]
	if not left or not right then error("Internal error: the color map does not have enough values for interval no " .. intervalno )end

	local result = {}
	for i = 1,self.colorspace.numComponents do
		local result_i = factor_two * left[i] + factor * right[i]

		result[i] = result_i
	end

	return result
end

-----------------------------------

-- global registry of all colormaps.
-- Key: colormap name
-- Value: an instance of ColorMap
ColorMaps = {}

end
