import * as lex from "./candidate-a-lex";
import { runMissScenarios } from "./miss-scenarios-real";

runMissScenarios(lex, process.argv[2] ?? "");

