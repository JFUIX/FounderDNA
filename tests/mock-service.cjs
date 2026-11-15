// Only UI orchestration is mocked here; database authorization has separate SQL tests.
module.exports.serviceMock=(reviewer=false)=>`(()=>{
const user={id:'test-user-a',email:'test-a@example.invalid'};
const state={business_requests:[{id:'request-a',reference:'FD-TEST',user_id:user.id,brief:{business:'Audit business',outcome:'Find a useful next step'},action:'Request Support',status:'Submitted',created_at:'2026-11-10T00:00:00Z',updated_at:'2026-11-10T00:00:00Z',contact_email:user.email,files:[]}],founder_dna:[],milestones:[],request_updates:[],request_introductions:[{id:'intro-a',request_id:'request-a',recipient:'A research partner',purpose:'Discuss customer research',information:'Public project summary only',consent:'Pending'}]};
const table=name=>{let op='read',payload,filters=[],returning=false;const q={
select(){if(op!=='read')returning=true;return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(){return q},
insert(row){op='insert';payload=row;return q},update(row){op='update';payload=row;return q},
then(resolve,reject){return Promise.resolve().then(()=>{
const rows=(state[name]||[]).filter(r=>filters.every(([k,v])=>r[k]===v));
if(op==='insert'){state[name].push({...payload,id:'new-'+state[name].length,created_at:new Date().toISOString()});return {data:null,error:null}}
if(op==='update'){if(name==='business_requests'&&window.qaFailStatus)return {data:null,error:{message:'Network interrupted'}};rows.forEach(r=>Object.assign(r,payload));return {data:returning?rows:null,error:null}}
return {data:rows,error:null};}).then(resolve,reject)}
};return q};
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user}},error:null}),getUser:async()=>({data:{user},error:null})},rpc:async()=>({data:${reviewer},error:null}),from:table})};
})()`;
