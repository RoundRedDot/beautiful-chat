import * as lex from "./current-lex";
import { runMissScenarios } from "./miss-scenarios-real";

runMissScenarios(lex, process.argv[2] ?? "");

