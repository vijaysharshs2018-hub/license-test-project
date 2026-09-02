const http=require('http');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const PORT=process.env.PORT||8787;const ADMIN_TOKEN=process.env.ADMIN_TOKEN||'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET';const DB=path.join(__dirname,'licenses.json');
function load(){try{return JSON.parse(fs.readFileSync(DB,'utf8'));}catch{return {licenses:{}}}}
function save(x){fs.writeFileSync(DB,JSON.stringify(x,null,2));}
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Admin-Token'});res.end(JSON.stringify(obj));}
function read(req){return new Promise((resolve,reject)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{try{resolve(b?JSON.parse(b):{});}catch(e){reject(e)}});});}
function active(rec){if(!rec||rec.status!=='active')return false;if(rec.expiresAt&&new Date(rec.expiresAt).getTime()<Date.now())return false;return true;}
const server=http.createServer(async(req,res)=>{if(req.method==='OPTIONS'){return json(res,204,{})}let u=new URL(req.url,'http://x');try{
 if(req.method==='GET'&&u.pathname==='/health')return json(res,200,{ok:true});
 const body=await read(req);const db=load();
 if(req.method==='POST'&&u.pathname==='/validate'){const {licenseKey,deviceId}=body;const rec=db.licenses[licenseKey];if(!active(rec))return json(res,403,{active:false,message:'License inactive or expired'});if(rec.deviceId&&rec.deviceId!==deviceId)return json(res,403,{active:false,message:'License is already activated on another installation'});if(!rec.deviceId){rec.deviceId=deviceId;rec.activatedAt=new Date().toISOString();save(db)}return json(res,200,{active:true,expiresAt:rec.expiresAt});}
 if(!req.headers['x-admin-token']||req.headers['x-admin-token']!==ADMIN_TOKEN)return json(res,401,{error:'Unauthorized'});
 if(req.method==='POST'&&u.pathname==='/admin/create'){const {licenseKey,expiresAt}=body;if(!licenseKey)return json(res,400,{error:'licenseKey required'});db.licenses[licenseKey]={status:'active',expiresAt:expiresAt||null,deviceId:null,createdAt:new Date().toISOString()};save(db);return json(res,200,{ok:true});}
 if(req.method==='POST'&&u.pathname==='/admin/status'){const {licenseKey,status}=body;if(!db.licenses[licenseKey])return json(res,404,{error:'Not found'});db.licenses[licenseKey].status=status==='active'?'active':'disabled';save(db);return json(res,200,{ok:true,record:db.licenses[licenseKey]});}
 if(req.method==='POST'&&u.pathname==='/admin/extend'){const {licenseKey,expiresAt}=body;if(!db.licenses[licenseKey])return json(res,404,{error:'Not found'});db.licenses[licenseKey].expiresAt=expiresAt;db.licenses[licenseKey].status='active';save(db);return json(res,200,{ok:true,record:db.licenses[licenseKey]});}
 if(req.method==='POST'&&u.pathname==='/admin/reset-device'){const {licenseKey}=body;if(!db.licenses[licenseKey])return json(res,404,{error:'Not found'});db.licenses[licenseKey].deviceId=null;save(db);return json(res,200,{ok:true});}
 if(req.method==='GET'&&u.pathname==='/admin/list'){return json(res,200,{licenses:db.licenses});}
 return json(res,404,{error:'Not found'});
}catch(e){return json(res,500,{error:e.message})}});server.listen(PORT,()=>console.log('License server listening on '+PORT));
