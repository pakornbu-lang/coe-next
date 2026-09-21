import {NextResponse,type NextRequest} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {readViewer} from "@/lib/auth/server";
import {homeForRole} from "@/lib/auth/types";
import {siteUrl} from "@/lib/auth/site-url";
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get("code");
 const next=request.nextUrl.searchParams.get("next");
 const response=(path:string)=>{const r=NextResponse.redirect(new URL(path,siteUrl()));r.headers.set("Cache-Control","private, no-store");r.headers.set("Referrer-Policy","no-referrer");return r;};
 if(code){
   const client=await createClient();
   const {data,error}=await client.auth.exchangeCodeForSession(code);
   if(!error&&data.user){
     if(next==="/reset-password")return response(next);
     const viewer=await readViewer(client,data.user);
     if(viewer)return response(homeForRole(viewer.role));
     await client.auth.signOut({scope:"local"});
   }
 }
 return response("/auth/confirmation-help");
}
