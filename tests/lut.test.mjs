import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCube } from '../lut.js';
for (const name of ['ETERNA','ETERNA-BB','WDR']) {
 const lut=parseCube(await readFile(new URL(`../assets/luts/${name}.cube`,import.meta.url),'utf8'));
 assert.equal(lut.size,33);assert.equal(lut.data.length,33**3*4);
 assert.equal(lut.data[3],255);
}
const identity='LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1';
const lut=parseCube(identity);
assert.deepEqual([...lut.data.slice(4,8)],[255,0,0,255]);
assert.deepEqual([...lut.data.slice(16,20)],[0,0,255,255]);
assert.throws(()=>parseCube('LUT_3D_SIZE 33\n0 0 0'),/不完整/);
assert.throws(()=>parseCube('LUT_3D_SIZE 2\nNaN 0 0'),/格式/);
assert.throws(()=>parseCube('DOMAIN_MIN -1 0 0\n'+identity),/色彩範圍/);
console.log('LUT validation passed: 3 official cubes, axis ordering, malformed input.');
