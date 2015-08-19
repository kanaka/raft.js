-- This file has dependencies to BOTH, the TeX part of pgfplots and the LUA part.
-- It is the only LUA component with this property.
--
-- Its purpose is to encapsulate the communication between TeX and LUA in a central LUA file
--
--
-- Here is the idea how the TeX backend communicates with the LUA backend:
--
-- * TeX can call LUA methods in order to "do something". The reverse direction is not true: LUA cannot call TeX methods.
--
-- * the only way that LUA can read TeX input values or write TeX output values is the top layer (at the time of this writing: only pgfplotstexio.lua ).
-- 
-- * The LUA backend has one main purpose: scalability and performance. 
--   Its purpose is _not_ to run a standalone visualization.
--   
--   The precise meaning of "scalability" is: the LUA backend should do as much
--   as possible which is done for single coordinates. Coordinates constitute
--   "scalability": the number of coordinates can become arbitrarily large.
--
--   "Performance" is related to scalability. But it is more: some dedicated
--   utility function might have a TeX backend and will be invoked whenever it
--   is needed. Candidates are colormap functions, z buffer arithmetics etc.
--   
--   Thus, the best way to ensure "scalability" is to move _everything_ which is to be done for a single coordinate to LUA.
--
--   Sometimes, this will be impossible or too expensive. 
--	 Here, "Performance" might still be optimized by some dedicated LUA function.
--
-- 
-- Unfortunately, the LUA backend does not simplify the code base - it makes it more complicated.
-- This is due to the way it is used: one needs to know when the TeX backend
-- delegates all its work to LUA. It is also due to the fact that it
-- duplicates code: the same code is present in TeX and in LUA. I chose to keep
-- the two code bases close to each other. This has a chance to simplify maintenance: if I know
-- how something works in TeX, and I find some entry point in LUA, it will
-- hopefully be closely related.
--
--
-- It follows an overview over entry points into the LUA backend:
--
-- * \begin{axis}. It invokes \pgfplots@prepare@LUA@api .
--     The purpose is to define the global pgfplots.gca "_g_et _c_urrent _a_xis" and to transfer some key presets.
--  
--     Log message: "lua backend=true: Activating LUA backend for axis."
--
-- * \end{axis}. It invokes \pgfplots@LUA@visualization@update@axis .
--     The purpose is to transfer results of the survey phase to LUA; in particular axis properties like
--     the view direction, data scale transformations, axis wide limits and some related properties.
--     This has nothing to do with coordinates; the survey phase of coordinates is handled in a different way (see below).
--
--     Eventually, \pgfplots@LUA@cleanup will clear the global pgfplots.gca .
--
-- * \addplot . This has much to do with scalability, so much of its functionality is done in the LUA backend.
--
--     Keep in mind that \addplot is part of the survey phase: it collects coordinates and updates axis limits.
--     Afterwards, it stores the survey results in the current axis.
--
--     The survey phase currently has two different ways to communicate with the LUA backend:
--
--      1. PARTIAL MODE. In this mode, the coordinate stream comes from TeX:
--      some TeX code generates the coordinates. Whenever the stream is ready,
--      it will invoke \pgfplots@LUA@survey@point .  This, in turn, calls the
--      LUA  backend in order to complete the survey (which boils down to
--      pgfplots.texSurveyPoint). PARTIAL MODE saves lots of time, but its
--      scalability is limited due to the intensive use of TeX, it is less
--      powerful than COMPLETE MODE.
--
--      2. COMPLETE MODE. In this mode, the entire coordinate stream is on the
--      LUA side. The TeX code will merely call start the survey phase, call
--      LUA, and end the survey phase. This is the most efficient
--      implementation. At the time of this writing, it is limited to `\addplot
--      expression`: the code for `\addplot expression` tries to transfer the
--      entire processing to the LUA backend. If it succeeds, it will do
--      nothing on the TeX side.
--
--      Both PARTIAL MODE and COMPLETE MODE call 
--        \pgfplots@LUA@survey@start : transfer plot type and current axis arguments to LUA
--      and
--        \pgfplots@LUA@survey@end : copy LUA axis arguments back to TeX.
--
--     Eventually,  the axis will initiate the visualization phase for each plot. This is done by
--        a) \pgfplots@LUA@visualization@init : it calls pgfplots.texVisualizationInit() and results in the log message
--               "lua backend=true: Activating partial LUA backend for visualization of plot 0".
--        b) \pgfplots@LUA@visualization@of@current@plot : it transfers control
--               to LUA (pgfplots.texVisualizePlot) and does as much with the
--               coordinates as possible. Eventually, it streams the result back to
--               TeX which will visualize the stream by means of PGF's plot streams.
--               This is somewhat complicated since it modifies the TeX streaming.
local pgfplotsmath = pgfplots.pgfplotsmath
local tex=tex
local tostring=tostring
local error=error
local table=table
local string=string
local pairs=pairs
local pcall=pcall
local type=type
local lpeg = require("lpeg")
local math = math

do
-- all globals will be read from/defined in pgfplots:
local _ENV = pgfplots

local pgftonumber = pgfluamathfunctions.tonumber

-- will be assigned by pgfplots at boot time.
LOAD_TIME_CATCODETABLE = nil

-- Called during \addplot, i.e. during the survey phase. It is only called in PARTIAL MODE (see above).
function texSurveyPoint(x,y,z,meta)
	local pt = Coord.new()
	pt.x[1] = x
	pt.x[2] = y
	pt.x[3] = z
	pt.meta = meta
	
	gca.currentPlotHandler:surveypoint(pt)
end

-- Copies survey results of the current plot back to TeX. It prints a couple of executable TeX statements as result.
-- @see \pgfplots@LUA@survey@end
function texSurveyEnd()
	local result = gca:surveyToPgfplots(gca.currentPlotHandler, true)
	--log("returning " .. result .. "\n\n")
    
	tex.sprint(LOAD_TIME_CATCODETABLE, result);
	gca.currentPlotHandler=nil
end

-- A performance optimization: point meta transformation is done on the LUA side.
--
-- expands to the transformed point meta
function texPerpointMetaTrafo(metaStr)
    local meta = pgftonumber(metaStr)
    local transformed = gca.currentPlotHandler:visualizationTransformMeta(meta);
    tex.sprint(LOAD_TIME_CATCODETABLE, tostringfixed(transformed));
end

-- Called at the beginning of each plot visualization.
--
-- expands to '1' if LUA is available for this plot and '0' otherwise.
-- @see texVisualizePlot
function texVisualizationInit(plotNum, plotIs3d)
	if not plotNum or plotIs3d==nil then error("arguments must not be nil") end

    local currentPlotHandler = gca.plothandlers[plotNum+1]
    gca.currentPlotHandler = currentPlotHandler; 
    if currentPlotHandler then
		currentPlotHandler.plotIs3d = plotIs3d
        currentPlotHandler:visualizationPhaseInit();
        tex.sprint("1") 
    else
        -- ok, this plot has no LUA support.
        tex.sprint("0") 
    end
end

local pgfXyCoordSerializer = function(pt)
	-- FIXME : it is unsure of whether this here really an improvement - or if it would be faster to compute that stuff in TeX...
	if pt.pgfXY ~=nil then
		return "{" .. tostringfixed(pt.pgfXY[1]) .. "}{" .. tostringfixed(pt.pgfXY[2]) .. "}"
	else
		return "{0}{0}"
	end
end

-- Actually does as much of the visualization of the current plot: it transforms all coordinates to some point where the TeX visualization mode continues.
--
-- It expands to the resulting coordinates. Note that these coordinates are already mapped somehow (typically: to fixed point)
-- @see texVisualizationInit
function texVisualizePlot(visualizerFactory)
	if not visualizerFactory then error("arguments must not be nil") end
	if type(visualizerFactory) ~= "function" then error("arguments must be a function (a factory)") end

    local currentPlotHandler = gca.currentPlotHandler
    if not currentPlotHandler then error("Illegal state: The current plot has no LUA plot handler!") end

	local visualizer = visualizerFactory(currentPlotHandler)

	local result = visualizer:getVisualizationOutput()
	local result_str = currentPlotHandler:getCoordsInTeXFormat(gca, result, pgfXyCoordSerializer)
	--log("returning " .. result_str .. "\n\n")
    tex.sprint(LOAD_TIME_CATCODETABLE, result_str)
end

-- Modifies the Surveyed coordinate list.
-- Expands to nothing
function texApplyZBufferReverseScanline(scanLineLength)
    local currentPlotHandler = gca.currentPlotHandler
    if not currentPlotHandler then error("This function cannot be used in the current context") end
    
    currentPlotHandler:reverseScanline(scanLineLength)
end 

-- Modifies the Surveyed coordinate list.
-- Expands to nothing
function texApplyZBufferReverseTransposed(scanLineLength)
    local currentPlotHandler = gca.currentPlotHandler
    if not currentPlotHandler then error("This function cannot be used in the current context") end
    
    currentPlotHandler:reverseTransposed(scanLineLength)
end 

-- Modifies the Surveyed coordinate list.
-- Expands to nothing
function texApplyZBufferReverseStream()
    local currentPlotHandler = gca.currentPlotHandler
    if not currentPlotHandler then error("This function cannot be used in the current context") end
    
    currentPlotHandler:reverseStream(scanLineLength)
end 

-- Modifies the Surveyed coordinate list.
-- 
-- Note that this is UNRELATED to mesh/surface plots! They have their own (patch-based) z buffer.
--
-- Expands to nothing
function texApplyZBufferSort()
    local currentPlotHandler = gca.currentPlotHandler
    if not currentPlotHandler then error("This function cannot be used in the current context") end
    
   currentPlotHandler:sortCoordinatesByViewDepth()
end 

-- Modifies the Surveyed coordinate list.
-- Expands to the resulting coordinates
function texGetSurveyedCoordsToPgfplots()
    local currentPlotHandler = gca.currentPlotHandler
    if not currentPlotHandler then error("This function cannot be used in the current context") end
    
    tex.sprint(LOAD_TIME_CATCODETABLE, currentPlotHandler:surveyedCoordsToPgfplots(gca))
end

-- Performance optimization: computes the colormap lookup.
function texColorMapPrecomputed(mapName, inMin, inMax, x)
	local colormap = ColorMaps[mapName];
	if colormap then
		local result = colormap:findPrecomputed(
			pgftonumber(inMin),
			pgftonumber(inMax),
			pgftonumber(x))

		local str = ""
		for i = 1,#result do
			if i>1 then str = str .. "," end
			str = str .. tostringfixed(result[i])
		end
		tex.sprint(LOAD_TIME_CATCODETABLE, str)
	end
end

local function isStripPrefixOrSuffixChar(char)
	return char == ' ' or char == '{' or char == "}"
end

-- Expressions can be something like
-- 	( {(6+(sin(3*(x+3*y))+1.25)*cos(x))*cos(y)},
--    {(6+(sin(3*(x+3*y))+1.25)*cos(x))*sin(y)},
--    {((sin(3*(x+3*y))+1.25)*sin(x))} );
--
-- These result in expressions = { " {...}", " {...}", " {...} " }
-- -> this function removes the surrounding braces and the white spaces.
local function removeSurroundingBraces(expressions)
	for i=1,#expressions do
		local expr = expressions[i]
		local startIdx
		local endIdx
		startIdx=1
		while startIdx<#expr and isStripPrefixOrSuffixChar(string.sub(expr,startIdx,startIdx)) do
			startIdx = startIdx+1
		end
		endIdx = #expr
		while endIdx > 0 and isStripPrefixOrSuffixChar(string.sub(expr,endIdx,endIdx)) do
			endIdx = endIdx-1
		end

		expr = string.sub(expr, startIdx, endIdx )
		expressions[i] = expr
	end
end

-------------
-- A parser for foreach statements - at least those which are supported in this LUA backend.
--
local samplesAtToDomain
do
	local P = lpeg.P
	local C = lpeg.C
	local V = lpeg.V
	local match = lpeg.match
	local space_pattern = P(" ")^0

	local Exp = V"Exp"
	local comma = P"," * space_pattern
	-- this does not catch balanced braces. Ok for now... ?
	local argument = C( ( 1- P"," )^1 ) * space_pattern
	local grammar = P{ "initialRule",
		initialRule = space_pattern * Exp * -1,
		Exp = lpeg.Ct(argument * comma * argument * comma * P"..." * space_pattern * comma *argument )
	}

	-- Converts very simple "samples at" values to "domain=A:B, samples=N"
	--
	-- @param foreachString something like -5,-4,...,5
	-- @return a table where
	-- 	[0] = domain min
	-- 	[1] = domain max
	-- 	[2] = samples
	-- 	It returns nil if foreachString is no "very simple value of 'samples at'"
	samplesAtToDomain = function(foreachString)
		local matches = match(grammar,foreachString)

		if not matches or #matches ~= 3 then
			return nil
		else
			local arg1 = matches[1]
			local arg2 = matches[2]
			local arg3 = matches[3]
			arg1= pgfluamathparser.pgfmathparse(arg1)
			arg2= pgfluamathparser.pgfmathparse(arg2)
			arg3= pgfluamathparser.pgfmathparse(arg3)

			if not arg1 or not arg2 or not arg3 then
				return nil
			end

			if arg1 > arg2 then
				return nil
			end

			local domainMin = arg1
			local h = arg2-arg1
			local domainMax = arg3
			
			-- round to the nearest integer (using +0.5, should be ok)
			local samples = math.floor((domainMax - domainMin)/h + 0.5) + 1

			return domainMin, domainMax, samples
		end
	end
end

-- This is the code which attempts to transfer control from `\addplot expression' to LUA.
--
-- If it succeeds, the entire plot stream and the entire survey phase has been done in LUA.
--
-- generates TeX output '1' on success and '0' on failure
-- @param debugMode one of a couple of strings: "off", "verbose", or "compileerror"
function texAddplotExpressionCoordinateGenerator(
	is3d, 
	xExpr, yExpr, zExpr, 
	sampleLine, 
	domainxmin, domainxmax, 
	domainymin, domainymax, 
	samplesx, samplesy, 
	variablex, variabley, 
	samplesAt,
	debugMode
)
	local plothandler = gca.currentPlotHandler
	local coordoutputstream = SurveyCoordOutputStream.new(plothandler)
	
	if samplesAt and string.len(samplesAt) >0 then
		-- "samples at" has higher priority than domain.
		-- Use it!

		domainxmin, domainxmax, samplesx = samplesAtToDomain(samplesAt)
		if not domainxmin then
			-- FAILURE: could not convert "samples at". 
			-- Fall back to a TeX based survey.
			log("log", "LUA survey failed: The value of 'samples at= " .. tostring(samplesAt) .. "' is unsupported by the LUA backend (currently, only 'samples at={a,b,...,c}' is supported).\n")
			tex.sprint("0")
			return
		end
			
	else
		domainxmin= pgftonumber(domainxmin)
		domainxmax= pgftonumber(domainxmax)
		samplesx= pgftonumber(samplesx)
	end

	local expressions
	local domainMin
	local domainMax
	local samples
	local variableNames

	-- allow both, even if sampleLine=1. We may want to assign a dummy value to y.
	variableNames = { variablex, variabley }

	if sampleLine==1 then
		domainMin = { domainxmin }
		domainMax = { domainxmax }
		samples = { samplesx }
	else
		local domainymin = pgftonumber(domainymin)
		local domainymax = pgftonumber(domainymax)
		local samplesy = pgftonumber(samplesy)

		domainMin = { domainxmin, domainymin }
		domainMax = { domainxmax, domainymax }
		samples = { samplesx, samplesy }
	end
	if is3d then
		expressions = {xExpr, yExpr, zExpr}
	else
		expressions = {xExpr, yExpr}
	end
	removeSurroundingBraces(expressions)

	local generator = AddplotExpressionCoordinateGenerator.new(
		coordoutputstream, 
		expressions,
		domainMin, domainMax,
		samples,
		variableNames)

	local messageOnFailure
	local compileErrorOnFailure
	if debugMode == "compileerror" then
		compileErrorOnFailure = true
		messageOnFailure = true
	elseif debugMode == "off" or debugMode == "verbose" then
		messageOnFailure = true
		compileErrorOnFailure = false
	elseif debugMode == "off and silent" then
		messageOnFailure = false
		compileErrorOnFailure = false
	else
		error("Got unknown debugMode = " .. debugMode )
	end
	
	local success
	if compileErrorOnFailure then
		success = generator:generateCoords()
	else
		local resultOfGenerator
		success, resultOfGenerator = pcall(generator.generateCoords, generator)
		if success then
			-- AH: "pcall" returned 'true'. In this case, 'success' is the boolean returned by generator
			success = resultOfGenerator
		end

		if messageOnFailure and not success and type(resultOfGenerator) ~= "boolean" then
			log("log", "LUA survey failed: " .. resultOfGenerator .. ". Use \\pgfplotsset{lua debug} to see more.\n")
		end
	end

	if not type(success) == 'boolean' then error("Illegal state: expected boolean result") end

	if success then
		tex.sprint("1")
	else
		tex.sprint("0")
	end
end

-- Creates the default plot visualizer factory. It simply applies data scale trafos.
function defaultPlotVisualizerFactory(plothandler)
	return PlotVisualizer.new(plothandler)
end

end
