
require("pgfplots.binary")

-- all classes/globals will be added to this table:
pgfplots = {}

-- will be set by TeX:
pgfplots.pgfplotsversion = nil

if _VERSION == "Lua 5.1" or _VERSION == "Lua 5.0" then
	texio.write("pgfplots: setting 'lua support=false': the lua version on this system is " .. _VERSION .. "; expected at least 'Lua 5.2'. Use a more recent TeX distribution to benefit from LUA in pgfplots.\n")
	
	-- the entire lua backend will be switched off if this is false:
	tex.sprint("\\pgfplotsset{lua support=false}")
	return
else
	-- well, 5.2 is what this stuff has been written for.
	-- Is there a good reason why it shouldn't work on 5.1 !? No, I guess not. Except that it took me a long time
	-- to figure out that 5.2 broke compatibility in lots of ways - and it was difficult enough to get it up and running.
	-- If someone wants (and needs) to run it in 5.1 - I would accept patches.
end

require("pgfplots.pgfplotsutil")

-- see pgfrcs.code.tex -- all versions after 3.0.0 (excluding 3.0.0) will set this version:
if not pgf or not pgf.pgfversion then
	pgfplots.log("log", "pgfplots.lua: loading complementary lua code for your pgf version...\n")
	pgfplots.pgfluamathfunctions = require("pgfplotsoldpgfsupp.luamath.functions")
	pgfplots.pgfluamathparser = require("pgfplotsoldpgfsupp.luamath.parser")
else
	pgfplots.pgfluamathparser = require("pgf.luamath.parser")
	pgfplots.pgfluamathfunctions = require("pgf.luamath.functions")
end
pgfplots.pgftonumber = pgfplots.pgfluamathfunctions.tonumber
pgfplots.tostringfixed = pgfplots.pgfluamathfunctions.tostringfixed
pgfplots.toTeXstring = pgfplots.pgfluamathfunctions.toTeXstring


require("pgfplots.plothandler")
require("pgfplots.meshplothandler")
require("pgfplots.colormap")
require("pgfplots.streamer")

-- hm. perhaps this here should become a separate module:
require("pgfplots.pgfplotstexio")
