import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const tests = fs.readdirSync('tests').filter(file => file.endsWith('.test.ts')).sort().map(file => `tests/${file}`);
execFileSync(process.execPath, ['--import', 'tsx', '--test', ...tests], { stdio: 'inherit' });
