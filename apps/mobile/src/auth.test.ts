import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAuth,jwtClaims,parseNativeAuthConfig,RefreshRejected,type AuthorizeResult,type NativeAuthPort,type StoreKey,type TokenSet} from './auth/session.ts';

const config={issuer:'https://idp.test/realms/tazumo',clientId:'tazumo-native',scope:'openid',apiUrl:'https://api.test'};
const b64=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt=(claims:object)=>`${b64({alg:'RS256'})}.${b64(claims)}.sig`;
const now=1_800_000_000_000;
const idToken=(over:object={})=>jwt({iss:config.issuer,aud:config.clientId,nonce:'nonce-1',email:'ana@tazumo.test',exp:now/1000+300,...over});
const tokens=(over:Partial<TokenSet>={}):TokenSet=>({accessToken:'access-1',refreshToken:'refresh-1',idToken:idToken(),expiresIn:300,...over});
const me={userId:'u1',roles:[{role:'customer',merchantId:null}]};

function fakePort(over:Partial<NativeAuthPort>={}){
  const calls:{name:string;args:unknown[]}[]=[];
  const saved=new Map<StoreKey,string>();
  const timers:{run:()=>void;ms:number}[]=[];
  const log=(name:string,...args:unknown[])=>calls.push({name,args});
  const port:NativeAuthPort={
    redirectUri:'tazumo://auth/callback',
    discover:async()=>({issuer:config.issuer,endSessionEndpoint:`${config.issuer}/logout`,promptValues:['none','login','create'],issParameter:true}),
    authorize:async(options)=>{log('authorize',options);return {type:'success',code:'code-1',codeVerifier:'verifier-1',iss:config.issuer} as AuthorizeResult},
    exchange:async(code,verifier)=>{log('exchange',code,verifier);return tokens()},
    refresh:async(token)=>{log('refresh',token);return tokens({accessToken:'access-2',refreshToken:'refresh-2'})},
    endSession:async(url)=>{log('endSession',url)},
    fetchMe:async(access)=>{log('fetchMe',access);return {status:200,body:me}},
    store:{get:async(key)=>saved.get(key)??null,set:async(key,value)=>{saved.set(key,value)},delete:async(key)=>{saved.delete(key)}},
    randomNonce:()=>'nonce-1',
    now:()=>now,
    setTimer:(run,ms)=>{timers.push({run,ms});return timers.length},
    clearTimer:()=>{},
    ...over,
  };
  return {port,calls,timers,saved,seed:(key:StoreKey,value:string)=>saved.set(key,value),called:(name:string)=>calls.filter(c=>c.name===name)};
}

test('config needs an issuer, a client ID and an API URL; without them the app has no sign-in',async()=>{
  assert.equal(parseNativeAuthConfig({issuer:config.issuer,clientId:'c'}),null);
  assert.equal(parseNativeAuthConfig({clientId:'c',apiUrl:'https://api.test'}),null);
  assert.deepEqual(parseNativeAuthConfig({issuer:`${config.issuer}/`,clientId:' tazumo-native ',apiUrl:'https://api.test/'}),config);
  const auth=createNativeAuth(null,null);
  await auth.start();
  await auth.signIn('sign-in');
  assert.deepEqual(auth.state(),{status:'unconfigured'});
});

test('sign-in keeps the access token in memory, stores only refresh and ID tokens, and takes the state from /v1/me',async()=>{
  const f=fakePort();
  const auth=createNativeAuth(config,f.port);
  assert.deepEqual(auth.state(),{status:'restoring'});
  await auth.start();
  assert.deepEqual(auth.state(),{status:'signed-out'});
  await auth.signIn('sign-in');
  assert.deepEqual(auth.state(),{status:'signed-in',me,email:'ana@tazumo.test'});
  assert.deepEqual(f.called('authorize')[0].args,[{nonce:'nonce-1'}]);
  assert.deepEqual(f.called('exchange')[0].args,['code-1','verifier-1']);
  assert.deepEqual(f.called('fetchMe')[0].args,['access-1']);
  assert.deepEqual(Object.fromEntries(f.saved),{refreshToken:'refresh-1',idToken:idToken()});
  assert.doesNotMatch([...f.saved.values()].join(),/access-1/);
  assert.equal(f.timers[0].ms,270_000);
});

test('create account asks for prompt=create only when discovery advertises it',async()=>{
  const f=fakePort();
  await createNativeAuth(config,f.port).signIn('sign-up');
  assert.deepEqual(f.called('authorize')[0].args,[{nonce:'nonce-1',prompt:'create'}]);
  const g=fakePort({discover:async()=>({issuer:config.issuer,promptValues:['none'],issParameter:false})});
  await createNativeAuth(config,g.port).signIn('sign-up');
  assert.deepEqual(g.called('authorize')[0].args,[{nonce:'nonce-1'}]);
});

test('a cancelled browser leaves the app signed out quietly; an error response is refused without an exchange',async()=>{
  const cancel=fakePort({authorize:async()=>({type:'cancel'})});
  const a=createNativeAuth(config,cancel.port);
  await a.signIn('sign-in');
  assert.deepEqual(a.state(),{status:'signed-out'});
  const error=fakePort({authorize:async()=>({type:'error'})});
  const b=createNativeAuth(config,error.port);
  await b.signIn('sign-in');
  assert.deepEqual(b.state(),{status:'signed-out',notice:'signInRefused'});
  assert.equal(cancel.called('exchange').length+error.called('exchange').length,0);
});

const rejected:[string,Partial<NativeAuthPort>,boolean][]=[
  ['a discovery document for another issuer',{discover:async()=>({issuer:'https://evil.test/realms/tazumo',promptValues:[],issParameter:true})},false],
  ['a callback without iss although discovery requires it',{authorize:async()=>({type:'success',code:'c',codeVerifier:'v'})},false],
  ['an expired ID token',{exchange:async()=>tokens({idToken:idToken({exp:now/1000-120})})},true],
  ['a callback iss for another issuer',{authorize:async()=>({type:'success',code:'c',codeVerifier:'v',iss:'https://evil.test'})},false],
  ['an ID token with another nonce',{exchange:async()=>tokens({idToken:idToken({nonce:'other'})})},true],
  ['an ID token from another issuer',{exchange:async()=>tokens({idToken:idToken({iss:'https://evil.test'})})},true],
  ['an ID token for another client',{exchange:async()=>tokens({idToken:idToken({aud:'tazumo-web'})})},true],
  ['no ID token',{exchange:async()=>tokens({idToken:undefined})},true],
];
for(const [name,over,exchanged] of rejected){
  test(`sign-in is rejected for ${name}, with nothing stored and no API call`,async()=>{
    const f=fakePort(over);
    const auth=createNativeAuth(config,f.port);
    await auth.signIn('sign-in');
    assert.deepEqual(auth.state(),{status:'signed-out',notice:'signInFailed'});
    assert.equal(f.saved.size,0);
    assert.equal(f.called('fetchMe').length,0);
    if(!exchanged)assert.equal(f.called('exchange').length,0);
  });
}

test('a stored session is restored with a refresh on start; a refused refresh clears it',async()=>{
  const f=fakePort();
  f.seed('refreshToken','refresh-1');
  f.seed('idToken',idToken());
  const auth=createNativeAuth(config,f.port);
  await auth.start();
  assert.deepEqual(auth.state(),{status:'signed-in',me,email:'ana@tazumo.test'});
  assert.deepEqual(f.called('fetchMe')[0].args,['access-2']);
  assert.equal(f.saved.get('refreshToken'),'refresh-2');
  const g=fakePort({refresh:async()=>{throw new RefreshRejected('invalid_grant')}});
  g.seed('refreshToken','stale');
  const expired=createNativeAuth(config,g.port);
  await expired.start();
  assert.deepEqual(expired.state(),{status:'signed-out',notice:'sessionEnded'});
  assert.equal(g.saved.size,0);
});

test('offline or an unavailable API keeps the stored session for the next start, and a scheduled refresh retries',async()=>{
  const offline=fakePort({refresh:async()=>{throw new TypeError('Network request failed')}});
  offline.seed('refreshToken','refresh-1');
  const a=createNativeAuth(config,offline.port);
  await a.start();
  assert.deepEqual(a.state(),{status:'signed-out',notice:'accountUnavailable'});
  assert.equal(offline.saved.get('refreshToken'),'refresh-1');
  const down=fakePort({fetchMe:async()=>({status:503})});
  down.seed('refreshToken','refresh-1');
  const b=createNativeAuth(config,down.port);
  await b.start();
  assert.deepEqual(b.state(),{status:'signed-out',notice:'accountUnavailable'});
  assert.equal(down.saved.get('refreshToken'),'refresh-2');
  let fail=false;
  const blip=fakePort({refresh:async()=>{if(fail)throw new TypeError('Network request failed');return tokens()}});
  const c=createNativeAuth(config,blip.port);
  await c.signIn('sign-in');
  fail=true;
  blip.timers[0].run();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(c.state().status,'signed-in');
  assert.equal(blip.timers.at(-1)!.ms,30_000);
  assert.equal(blip.saved.get('refreshToken'),'refresh-1');
});

test('a second tap while signing in does not start another browser session',async()=>{
  let finish:(r:AuthorizeResult)=>void=()=>{},opened=0;
  const f=fakePort({authorize:()=>{opened++;return new Promise<AuthorizeResult>(resolve=>{finish=resolve})}});
  const auth=createNativeAuth(config,f.port);
  const first=auth.signIn('sign-in');
  await new Promise(resolve=>setImmediate(resolve));
  await auth.signIn('sign-in');
  finish({type:'cancel'});
  await first;
  assert.equal(opened,1);
  assert.deepEqual(auth.state(),{status:'signed-out'});
});

test('each stored value stays under the 2048-byte secure-store limit with realistic token sizes',async()=>{
  const f=fakePort({exchange:async()=>tokens({refreshToken:'r'.repeat(900),idToken:idToken({name:'x'.repeat(1000)})})});
  await createNativeAuth(config,f.port).signIn('sign-in');
  for(const value of f.saved.values())assert.ok(new TextEncoder().encode(value).length<2048);
});

test('the refresh timer rotates tokens; a refresh that finishes after sign-out is dropped',async()=>{
  let release:(t:TokenSet)=>void=()=>{};
  const f=fakePort({refresh:()=>new Promise<TokenSet>(resolve=>{release=resolve})});
  const auth=createNativeAuth(config,f.port);
  await auth.signIn('sign-in');
  f.timers[0].run();
  await auth.signOut();
  release(tokens({accessToken:'late',refreshToken:'late-refresh'}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(auth.state(),{status:'signed-out'});
  assert.equal(f.saved.size,0);
});

test('sign-out ends the provider session in the system browser and clears secure storage',async()=>{
  const f=fakePort();
  const auth=createNativeAuth(config,f.port);
  await auth.signIn('sign-in');
  const states:string[]=[];
  auth.subscribe(()=>states.push(auth.state().status));
  await auth.signOut();
  const url=new URL(String(f.called('endSession')[0].args[0]));
  assert.equal(url.origin+url.pathname,`${config.issuer}/logout`);
  assert.equal(url.searchParams.get('client_id'),'tazumo-native');
  assert.equal(url.searchParams.get('post_logout_redirect_uri'),'tazumo://auth/callback');
  assert.equal(url.searchParams.get('id_token_hint'),idToken());
  assert.deepEqual(states,['signing-out','signed-out']);
  assert.equal(f.saved.size,0);
});

test('/v1/me decides the state: 401 ends the session and forgets it, other failures say the account is unavailable',async()=>{
  for(const [status,notice,kept] of [[401,'sessionEnded',0],[503,'accountUnavailable',2]] as const){
    const f=fakePort({fetchMe:async()=>({status})});
    const auth=createNativeAuth(config,f.port);
    await auth.signIn('sign-in');
    assert.deepEqual(auth.state(),{status:'signed-out',notice});
    assert.equal(f.saved.size,kept);
  }
});

test('no token reaches the console',async()=>{
  const lines:string[]=[];
  const original={log:console.log,warn:console.warn,error:console.error,info:console.info};
  for(const key of Object.keys(original) as (keyof typeof original)[])console[key]=(...args:unknown[])=>lines.push(args.map(String).join(' '));
  try{
    const f=fakePort();
    const auth=createNativeAuth(config,f.port);
    await auth.signIn('sign-in');
    f.timers[0].run();
    await auth.signOut();
  }finally{Object.assign(console,original)}
  assert.doesNotMatch(lines.join('\n'),/access-|refresh-|eyJ/);
});

test('jwtClaims decodes UTF-8 payloads',()=>{
  assert.equal(jwtClaims(jwt({name:'Žofie'})).name,'Žofie');
});
