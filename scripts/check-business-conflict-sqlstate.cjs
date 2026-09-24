// Offline regression tests: PostgreSQL engine via PGlite, never a live RPC.
const fs=require("node:fs"),assert=require("node:assert/strict");
const {PGlite}=require(process.env.PGLITE_MODULE||"@electric-sql/pglite");
(async()=>{
 const db=new PGlite();
 const path="supabase/migrations/20260924030000_fix_business_conflict_sqlstate.sql";
 const migration=fs.readFileSync(path,"utf8");
 const targets=[...migration.split(') as targets')[0].matchAll(/\('(public|private)','([a-z_0-9]+)'\)/g)].map(m=>m[1]+"."+m[2]);
 assert.equal(targets.length,12);
 // Check latest repository definitions, not superseded migration bodies.
 const defs=new Map();
 for(const file of fs.readdirSync("supabase/migrations").sort()){
  if(!file.endsWith(".sql")||file==="20260924030000_fix_business_conflict_sqlstate.sql")continue;
  const source=fs.readFileSync("supabase/migrations/"+file,"utf8");
  const matches=[...source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(/gi)];
  for(let i=0;i<matches.length;i++)defs.set(matches[i][1],source.slice(matches[i].index,matches[i+1]?.index??source.length));
 }
 const affected=[...defs].filter(([,body])=>body.includes("'40001'"));
 assert.deepEqual(affected.map(([name])=>name).sort(),[...targets].sort());
 const pattern=/raise\s+exception\s+('STALE_VERSION'|'Appeal is not available or changed')\s+using\s+errcode\s*=\s*'40001'/gi;
 for(const [name,body]of affected){
  assert.ok(!body.replace(pattern,"").includes("'40001'"),"Unknown error form: "+name);
 }
 await db.exec("create schema private; create role authenticated; create role anon;");
 for(const name of targets){
  const statements=defs.get(name).match(pattern);
  const body=statements.map((s,i)=>"if p_mode="+(i+1)+" then "+s+"; end if;").join("\n");
  await db.exec("create function "+name+"(p_mode integer) returns integer language plpgsql security definer set search_path='' as $$ begin "+body+" return 7; end; $$; revoke all on function "+name+"(integer) from public; grant execute on function "+name+"(integer) to authenticated;");
 }
 await db.exec("create function public.genuine_serialization() returns void language plpgsql as $$ begin raise exception 'serialization conflict' using errcode='40001'; end; $$;");
 const metadata=()=>db.query("select n.nspname,p.proname,p.proowner,p.proacl::text,p.prosecdef,p.proconfig::text,pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1,2");
 const before=(await metadata()).rows;
 await db.exec(migration);
 assert.deepEqual((await metadata()).rows,before);
 for(const name of targets){
  assert.equal((await db.query("select "+name+"(0) as n")).rows[0].n,7);
  for(let i=1;i<=defs.get(name).match(pattern).length;i++){
   await assert.rejects(()=>db.query("select "+name+"($1)",[i]),e=>e.code==="PT409"&&["STALE_VERSION","Appeal is not available or changed"].includes(e.message));
  }
 }
 await assert.rejects(()=>db.query("select genuine_serialization()"),e=>e.code==="40001");
 await db.exec(migration); // Safe rerun.
 // Verify fail-closed behavior: an unrecognised handler rolls back earlier edits.
 await db.exec("create or replace function private.portal_admin_member(p_mode integer) returns integer language plpgsql security definer set search_path='' as $$ begin raise exception 'STALE_VERSION' using errcode='40001'; end; $$;");
 await db.exec("create or replace function public.staff_schedule_interview_v2(p_mode integer) returns integer language plpgsql security definer set search_path='' as $$ begin return 8; end; $$;");
 await assert.rejects(()=>db.exec(migration),/Expected conflict handler in at least one overload/);
 await db.exec("rollback");
 await assert.rejects(()=>db.query("select private.portal_admin_member(1)"),e=>e.code==="40001");
 await db.close();
 console.log("PASS: all 12 current function handlers covered; PT409 on business conflicts; normal returns, privileges, signatures, owner and security settings preserved; true 40001 untouched; rerun safe; unexpected schema rolls back.");
})().catch(e=>{console.error(e);process.exitCode=1;});
