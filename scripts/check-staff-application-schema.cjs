const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('lib/scholarships/server.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let fail=false;let selected='';const filters=[];
const row={id:'application',student_name:'นักศึกษาทดลอง',student_code:'123',application_no:1,scholarship:{title:'ทุนทดลอง'}};
const client={from(table){assert.equal(table,'applications');return {select(fields){selected=fields;return this},order(){return this},limit(){return this},eq(key,value){filters.push([key,value]);return this},then(resolve){const missing=/eligible_faculties|eligible_majors/.test(selected);return Promise.resolve({data:fail||missing?null:[row],error:fail||missing?{code:missing?'42703':'42501'}:null}).then(resolve)}}}};
const exportsObject={};vm.runInNewContext(code,{exports:exportsObject,require(name){if(name==='server-only')return {};if(name==='react')return {cache:(fn)=>fn};if(name==='@/lib/supabase/server')return {createClient:async()=>client};if(name==='@/lib/integrations/sis')return {};throw Error(name)}});
(async()=>{
assert.equal((await exportsObject.listStaffApplications()).length,1);
assert.ok(!selected.includes('eligible_faculties'));
assert.equal((await exportsObject.listStaffApplications('submitted','ทุนทดลอง')).length,1);
assert.equal(filters[0].join(','),'status,submitted');
assert.equal((await exportsObject.listStaffApplications(undefined,'ไม่พบ')).length,0);
fail=true;await assert.rejects(()=>exportsObject.listStaffApplications(),/ไม่สามารถโหลดใบสมัครสำหรับเจ้าหน้าที่ได้/);
console.log('PASS: legacy-schema staff listing, status filter, search and genuine error propagation');
})().catch(e=>{console.error(e);process.exitCode=1});
