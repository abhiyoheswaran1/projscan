#!/usr/bin/env node

import { program } from './_shared.js';
import { registerCliCommands } from './registerCommands.js';

registerCliCommands();
program.parse();
