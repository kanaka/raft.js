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
local mathfloor=math.floor
local mathceil=math.ceil
local pgfmathparse = pgfplots.pgfluamathparser.pgfmathparse

do
-- all globals will be read from/defined in pgfplots:
local _ENV = pgfplots

local pgftonumber =pgfluamathfunctions.tonumber

function texBoxPlotSurveyPoint(data)
	gca.currentPlotHandler:semiSurveyedValue(data)
end

-------------------------------------------------------

PercentileEstimator = newClass()

function PercentileEstimator:constructor()
end

function PercentileEstimator:getIndex(data, i)
	local idx = i
	if idx < 1 then idx = 1 end
	if idx > #data then idx = #data end

	local result = data[idx]
	if not result then
		error("Box plot percentile estimator '" .. tostring(self) .." accessed illegal array index " .. tostring(idx) .. " in array of length " .. tostring(#data))
	end
	return result
end
	

-- @param percentile the requested percentile. Use 0.5 for the median, 0.25 for the first quartile, 0.95 for the 95% percentile etc.
function PercentileEstimator:getValue(percentile, data)
	error("Use implementation of PercentileEstimator, not interface")
end

-- LegacyPgfplotsPercentileEstimator is a minimally repaired percentile estimator as it has been shipped with pgfplots.10 .
-- I decided to mark it as deprecated because it is non-standard and not comparable with other programs.
LegacyPgfplotsPercentileEstimator = newClassExtends(PercentileEstimator)
function LegacyPgfplotsPercentileEstimator:constructor()
end
function LegacyPgfplotsPercentileEstimator:__tostring()
	return "estimator=legacy";
end
function LegacyPgfplotsPercentileEstimator:getValue(percentile, data)
	if not percentile or not data then error("Arguments must not be nil") end
	local numCoords = #data
	local h = numCoords * percentile

	local offset_low = mathfloor(h)
	local isInt = ( h==offset_low )

	local offset_high = offset_low+1 
	
	local x_low = self:getIndex(data, offset_low)
	local x_up = self:getIndex(data, offset_high)
	local res = x_low
	if not isInt then
		res = 0.5 * (res + x_up)
	end
	return res
end

-- LegacyBadPgfplotsPercentileEstimator is _the_ percentile estimator as it has been shipped with pgfplots 1.10.
-- It has bugs and is non-standard. Don't use it.
LegacyBadPgfplotsPercentileEstimator = newClassExtends(PercentileEstimator)
function LegacyBadPgfplotsPercentileEstimator:constructor()
end
function LegacyBadPgfplotsPercentileEstimator:__tostring()
	return "estimator=legacy*";
end
function LegacyBadPgfplotsPercentileEstimator:getValue(percentile, data)
	if not percentile or not data then error("Arguments must not be nil") end
	local numCoords = #data
	local h = (numCoords-1) * percentile

	local offset_low = mathfloor(h)
	local isInt = ( h==offset_low )

	local offset_high = offset_low+1 
	
	local x_low = self:getIndex(data, offset_low+1)
	local x_up = self:getIndex(data, offset_high+1)
	local res = x_low
	if not isInt then
		res = 0.5 * (res + x_up)
	end
	return res
end
----------------

ParameterizedPercentileEstimator = newClassExtends(PercentileEstimator)

function ParameterizedPercentileEstimator:__tostring()
	return "estimator=" .. tostring(self.typeFlag) ;
end

function ParameterizedPercentileEstimator:constructor( typeFlag )
	-- http://en.wikipedia.org/wiki/Quantile
	self.typeFlag = typeFlag

	local getIndex = self.getIndex

	local stdLookup = function(data, h )
		local h_low = mathfloor(h)
		local x_low = getIndex(self, data, h_low )
		local x_up = getIndex(self, data, h_low +1 )
		return x_low + (h - h_low) * (x_up - x_low)
	end
	
	if typeFlag == 1 then
		-- R1 
		self.getValue = function(self, percentile, data)
			local h= #data * percentile
			return getIndex(self, data, mathceil(h) )
		end
	elseif typeFlag == 2 then
		-- R2 
		self.getValue = function(self, percentile, data)
			local h= #data * percentile + 0.5
			return 0.5*(getIndex(self, data, mathceil(h-0.5)) + getIndex(self, data, mathfloor(h+0.5) ) )
		end
	elseif typeFlag == 3 then
		-- R3 
		self.getValue = function(self, percentile, data)
			local h= #data * percentile
			return getIndex(self, data, pgfluamathfunctions.round(h) )
		end
	elseif typeFlag == 4 then
		-- R4 
		self.getValue = function(self, percentile, data)
			local h= #data * percentile
			return stdLookup(data,h)
		end
	elseif typeFlag == 5 then
		-- R5 
		self.getValue = function(self, percentile, data)
			local h= #data * percentile + 0.5
			return stdLookup(data,h)
		end
	elseif typeFlag == 6 then
		-- R6 
		self.getValue = function(self, percentile, data)
			local h= (#data +1) * percentile
			return stdLookup(data,h)
		end
	elseif typeFlag == 7 then
		-- R7 (Excel)
		self.getValue = function(self, percentile, data)
			local h= (#data -1) * percentile + 1
			return stdLookup(data,h)
		end
	elseif typeFlag == 8 then
		-- R8 
		self.getValue = function(self, percentile, data)
			local h= (#data + 1/3) * percentile + 1/3
			return stdLookup(data,h)
		end
	elseif typeFlag == 9 then
		-- R9 
		self.getValue = function(self, percentile, data)
			local h= (#data + 1/4) * percentile + 3/8
			return stdLookup(data,h)
		end
	else
		error("Got unsupported type '" .. tostring(typeFlag) .. "'")
	end
end


getPercentileEstimator = function(estimatorName) 
	if estimatorName == "legacy" then
		return LegacyPgfplotsPercentileEstimator.new()
	elseif estimatorName == "legacy*" then
		return LegacyBadPgfplotsPercentileEstimator.new()
	elseif estimatorName == "R1" then
		return ParameterizedPercentileEstimator.new(1)
	elseif estimatorName == "R2" then
		return ParameterizedPercentileEstimator.new(2)
	elseif estimatorName == "R3" then
		return ParameterizedPercentileEstimator.new(3)
	elseif estimatorName == "R4" then
		return ParameterizedPercentileEstimator.new(4)
	elseif estimatorName == "R5" then
		return ParameterizedPercentileEstimator.new(5)
	elseif estimatorName == "R6" then
		return ParameterizedPercentileEstimator.new(6)
	elseif estimatorName == "R7" then
		return ParameterizedPercentileEstimator.new(7)
	elseif estimatorName == "R8" then
		return ParameterizedPercentileEstimator.new(8)
	elseif estimatorName == "R9" then
		return ParameterizedPercentileEstimator.new(9)
	end

	error("Unknown estimator '" .. tostring(estimatorName) .. "'")
end

BoxPlotRequest = newClass()

-- @param lowerQuartialPercent: typically 0.25
-- @param upperQuartialPercent: typically 0.75
-- @param whiskerRange: typically 1.5
-- @param estimator: an instance of PercentileEstimator
-- @param morePercentiles: either nil or an array of percentiles to compute
function BoxPlotRequest:constructor(lowerQuartialPercent, upperQuartialPercent, whiskerRange, estimator, morePercentiles)
	if not lowerQuartialPercent or not upperQuartialPercent or not whiskerRange or not estimator then error("Arguments must not be nil") end
	self.lowerQuartialPercent = pgftonumber(lowerQuartialPercent)
	self.upperQuartialPercent = pgftonumber(upperQuartialPercent)
	self.whiskerRange = pgftonumber(whiskerRange)
	self.estimator = estimator
	if not morePercentiles then
		self.morePercentiles = {}
	else
		self.morePercentiles = morePercentiles
	end
end

-------------------------------------------------------

BoxPlotResponse = newClass()

function BoxPlotResponse:constructor()
	self.lowerWhisker = nil
	self.lowerQuartile = nil
	self.median = nil
	self.upperQuartile = nil
	self.upperWhisker = nil
	self.average = nil
	self.morePercentiles = {}
	self.outliers = {}
end

-- @param boxPlotRequest an instance of BoxPlotRequest
-- @param data an indexed array with float values
-- @return an instance of BoxPlotResponse
function boxPlotCompute(boxPlotRequest, data)
	if not boxPlotRequest or not data then error("Arguments must not be nil") end
	
	for i = 1,#data do
		local data_i = data[i]
		if data_i == nil or type(data_i) ~= "number" then
			error("Illegal input array at index " .. tostring(i) .. ": " .. tostring(data_i))
		end
	end

	table.sort(data)

	local sum = 0
	for i = 1,#data do
		sum = sum + data[i]
	end
	
	local numCoords = #data

	local lowerWhisker
	local lowerQuartile = 	boxPlotRequest.estimator:getValue(boxPlotRequest.lowerQuartialPercent, data)
	local median = 			boxPlotRequest.estimator:getValue(0.5, data)
	local upperQuartile = 	boxPlotRequest.estimator:getValue(boxPlotRequest.upperQuartialPercent, data)

	local morePercentileValues = {}
	for i = 1,#boxPlotRequest.morePercentiles do
		morePercentileValues[i] = boxPlotRequest.estimator:getValue(boxPlotRequest.morePercentiles[i], data)
	end

	local upperWhisker
	local average = sum / numCoords

	local whiskerRange = boxPlotRequest.whiskerRange
	local whiskerWidth = whiskerRange*(upperQuartile - lowerQuartile)
	local upperWhiskerValue = upperQuartile + whiskerWidth
	local lowerWhiskerValue = lowerQuartile - whiskerWidth

	local outliers = {}
	for i = 1,numCoords do
		local current = data[i]
		if current < lowerWhiskerValue then
			table.insert(outliers, current)
		else
			lowerWhisker = current
			break
		end
	end

	for i = numCoords,1,-1 do
		local current = data[i]
		if upperWhiskerValue < current then
			table.insert(outliers, current)
		else
			upperWhisker = current
			break
		end
	end

	local result = BoxPlotResponse.new()
	result.lowerWhisker = lowerWhisker
	result.lowerQuartile = lowerQuartile
	result.median = median
	result.upperQuartile = upperQuartile
	result.upperWhisker = upperWhisker
	result.average = average
	result.morePercentiles = morePercentileValues
	result.outliers = outliers

	return result
end

-------------------------------------------------------
-- Replicates the survey phase of \pgfplotsplothandlerboxplot 
BoxPlotPlothandler = newClassExtends(Plothandler)

-- drawDirection : either "x" or "y".
function BoxPlotPlothandler:constructor(boxPlotRequest, drawDirection, drawPosition, axis, pointmetainputhandler)
	if not boxPlotRequest or not drawDirection or not drawPosition then error("Arguments must not be nil") end
    Plothandler.constructor(self,"boxplot", axis, pointmetainputhandler)
	self.boxPlotRequest = boxPlotRequest

	local function evaluateDrawPosition()
		local result = pgfmathparse(drawPosition)
		return result
	end

	if drawDirection == "x" then
		self.boxplotsetxy = function (a,b) return a,evaluateDrawPosition() + b end
	elseif drawDirection == "y" then
		self.boxplotsetxy = function (a,b) return evaluateDrawPosition() + b,a end
	else
		error("Illegal argument drawDirection="..tostring(drawDirection) )
	end
end

function BoxPlotPlothandler:surveystart()
	self.boxplotInput = {}
	self.boxplotSurveyMode = true
end


function BoxPlotPlothandler:surveyend()
	self.boxplotSurveyMode = false

	local computed = boxPlotCompute( self.boxPlotRequest, self.boxplotInput )

	local texResult = 
		"\\pgfplotsplothandlersurveyend@boxplot@set{lower whisker}{"  .. toTeXstring(computed.lowerWhisker) .. "}" ..
		"\\pgfplotsplothandlersurveyend@boxplot@set{lower quartile}{" .. toTeXstring(computed.lowerQuartile) .. "}" ..
		"\\pgfplotsplothandlersurveyend@boxplot@set{median}{"         .. toTeXstring(computed.median) .. "}" ..
		"\\pgfplotsplothandlersurveyend@boxplot@set{upper quartile}{" .. toTeXstring(computed.upperQuartile) .. "}" ..
		"\\pgfplotsplothandlersurveyend@boxplot@set{upper whisker}{"  .. toTeXstring(computed.upperWhisker) .. "}" ..
		"\\pgfplotsplothandlersurveyend@boxplot@set{sample size}{"    .. toTeXstring(# self.boxplotInput) .. "}"
		
	self.boxplotInput = nil
	Plothandler.surveystart(self)
	
	local outliers = computed.outliers
	for i =1,#outliers do
		local outlier = outliers[i]
		local pt = Coord.new()
		-- this here resembles \pgfplotsplothandlersurveypoint@boxplot@prepared when it is invoked during boxplot:
		local X,Y = self.boxplotsetxy(outlier, 0)
		pt.x = { X, Y, nil }
		Plothandler.surveypoint(self,pt)
	end
	Plothandler.surveyend(self)

	return texResult
end

function BoxPlotPlothandler:semiSurveyedValue(data)
    local result = pgftonumber(data)
	if result then
		table.insert( self.boxplotInput, result )
	end
end

function BoxPlotPlothandler:surveypoint(pt)
	if self.boxplotSurveyMode then
		error("Unsupported Operation encountered: box plot survey in LUA are only in PARTIAL mode (i.e. only if almost all has been prepared in TeX. Use 'lua backend=false' to get around this.")
	else
		Plothandler.surveypoint(self,pt)
	end
end

-------------------------------------------------------

end
