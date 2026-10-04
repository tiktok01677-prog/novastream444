/* AspireCompass: bounded expression parser. No eval, network calls or AI answers. */
(function(root){
 'use strict';
 const funcs=new Set(['sqrt','sin','cos','tan','asin','acos','atan','ln','log','abs','exp']);
 const constants={pi:Math.PI,e:Math.E};
 function parse(source){
  source=String(source).trim().replace(/π/g,'pi').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/²/g,'^2').replace(/³/g,'^3');
  if(!source || source.length>300)throw Error('Enter an expression with 1–300 characters.');
  const raw=[];let offset=0;
  while(offset<source.length){
   if(/\s/.test(source[offset])){offset++;continue;}
   const s=source.slice(offset),m=s.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
   if(m){let v=Number(m[0]);if(!Number.isFinite(v))throw Error('Number is too large.');raw.push({t:'n',v});offset+=m[0].length;continue;}
   const id=s.match(/^[a-zA-Z]+/);if(id){raw.push({t:'id',v:id[0].toLowerCase()});offset+=id[0].length;continue;}
   if('+-*/^()!%'.includes(s[0])){raw.push({t:s[0]});offset++;continue;}throw Error('Unsupported character: '+s[0]);
  }
  if(raw.length>180)throw Error('Expression is too long.');
  const tokens=[];
  raw.forEach((cur,i)=>{const prev=raw[i-1];if(prev && ['n','id',')','!','%'].includes(prev.t)&&['n','id','('].includes(cur.t)&&!(prev.t==='id'&&funcs.has(prev.v)&&cur.t==='('))tokens.push({t:'*'});tokens.push(cur);});
  let pos=0,depth=0;const peek=()=>tokens[pos]||{t:'end'};const take=t=>peek().t===t?(pos++,true):false;
  function atom(){if(++depth>70)throw Error('Expression nesting is too deep.');let node,t=peek();
   if(take('n'))node={k:'num',v:t.v};
   else if(take('id')){if(funcs.has(t.v)){if(!take('('))throw Error('Use parentheses after '+t.v+'.');node={k:'fn',f:t.v,a:add()};if(!take(')'))throw Error('Close the function parentheses.');}else if(t.v in constants)node={k:'num',v:constants[t.v]};else if(['x','y','z'].includes(t.v))node={k:'var',v:t.v};else throw Error('Unknown name: '+t.v);}
   else if(take('(')){node=add();if(!take(')'))throw Error('A closing parenthesis is missing.');}
   else throw Error('A number, variable or function is missing.');
   while(['!','%'].includes(peek().t)){node={k:'post',op:tokens[pos++].t,a:node};}depth--;return node;
  }
  function power(){let a=atom();if(take('^'))a={k:'op',op:'^',a,b:unary()};return a;}
  function unary(){if(take('+'))return unary();if(take('-'))return {k:'neg',a:unary()};return power();}
  function mul(){let a=unary();while(['*','/'].includes(peek().t)){const op=tokens[pos++].t;a={k:'op',op,a,b:unary()};}return a;}
  function add(){let a=mul();while(['+','-'].includes(peek().t)){const op=tokens[pos++].t;a={k:'op',op,a,b:mul()};}return a;}
  const ast=add();if(pos!==tokens.length)throw Error('Check the expression syntax.');return ast;
 }
 function finite(v){if(!Number.isFinite(v))throw Error('Result is outside the real-number range.');return v;}
 function evaluate(ast,scope={},angle='deg'){
  function walk(n){
   if(n.k==='num')return n.v;if(n.k==='var'){if(!(n.v in scope))throw Error('Use the Solver or Graph tab for variables.');return finite(scope[n.v]);}
   if(n.k==='neg')return -walk(n.a);
   if(n.k==='post'){const a=walk(n.a);if(n.op==='%')return a/100;if(!Number.isInteger(a)||a<0||a>170)throw Error('Factorial needs an integer from 0 to 170.');let v=1;for(let i=2;i<=a;i++)v*=i;return v;}
   if(n.k==='fn'){let a=walk(n.a),v;const f=n.f;if(['sin','cos','tan'].includes(f)){if(angle==='deg')a*=Math.PI/180;if(f==='tan'&&Math.abs(Math.cos(a))<1e-14)throw Error('Tangent is undefined at this angle.');v=Math[f](a);}else if(['asin','acos','atan'].includes(f)){v=Math[f](a);if(angle==='deg')v*=180/Math.PI;}else v=({sqrt:Math.sqrt,ln:Math.log,log:Math.log10,abs:Math.abs,exp:Math.exp})[f](a);return finite(v);}
   const a=walk(n.a),b=walk(n.b);if(n.op==='/'&&b===0)throw Error('Division by zero is undefined.');return finite(({'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'^':()=>Math.pow(a,b)})[n.op]());
  }return finite(walk(ast));
 }
 function polynomial(ast,variable='x'){
  const trim=a=>{while(a.length>1&&a.at(-1)===0)a.pop();if(a.some(v=>!Number.isFinite(v)))throw Error('Coefficients are outside the numeric range.');if(a.length>3)throw Error('This solver supports linear and quadratic polynomials only.');return a;};
  const plus=(a,b,s=1)=>trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0)+s*(b[i]||0)));
  const times=(a,b)=>{let r=Array(a.length+b.length-1).fill(0);a.forEach((v,i)=>b.forEach((w,j)=>r[i+j]+=v*w));return trim(r);};
  function walk(n){
   if(n.k==='num')return [n.v];if(n.k==='var'){if(n.v!==variable)throw Error('Use only '+variable+' in this equation.');return [0,1];}
   if(n.k==='neg')return walk(n.a).map(v=>-v);
   if(n.k==='fn'||n.k==='post'){const a=walk(n.a);if(a.length>1)throw Error('Functions of variables are not supported by this polynomial solver.');return [evaluate(n)];}
   const a=walk(n.a),b=walk(n.b);if(n.op==='+')return plus(a,b);if(n.op==='-')return plus(a,b,-1);if(n.op==='*')return times(a,b);
   if(n.op==='/'){if(b.length>1)throw Error('Variable denominators are not supported.');if(b[0]===0)throw Error('Division by zero is undefined.');return trim(a.map(v=>v/b[0]));}
   if(b.length>1||!Number.isInteger(b[0])||b[0]<0||b[0]>8)throw Error('Use a non-negative integer power up to 8.');let r=[1];for(let i=0;i<b[0];i++)r=times(r,a);return r;
  }return walk(ast);
 }
 function equationParts(source){const p=source.split('=');if(p.length>2)throw Error('Use one equals sign.');if(p.length===1)p.push('0');if(p.some(v=>!v.trim()))throw Error('Both sides of the equation are required.');return p.map(parse);}
 function solve(source){const [left,right]=equationParts(source),l=polynomial(left),r=polynomial(right),co=Array.from({length:3},(_,i)=>(l[i]||0)-(r[i]||0));if(co.some(v=>!Number.isFinite(v)))throw Error('Coefficients are too large.');
  const [c,b,a]=co,scale=Math.max(...co.map(Math.abs))||1,A=a/scale,B=b/scale,C=c/scale;
  if(a===0){if(b===0)return {type:c===0?'identity':'none',co,roots:[]};return {type:'linear',co,roots:[{re:finite(-C/B),im:0}]};}
  const d=B*B-4*A*C;let roots;if(d<0){const re=finite(-B/(2*A)),im=finite(Math.sqrt(-d)/(2*Math.abs(A)));roots=[{re,im},{re,im:-im}];}
  else if(d===0)roots=[{re:finite(-B/(2*A)),im:0}];else{const q=-.5*(B+(B>=0?1:-1)*Math.sqrt(d));roots=[{re:finite(q/A),im:0},{re:finite(C/q),im:0}].sort((x,y)=>x.re-y.re);}
  const residuals=roots.map(({re,im})=>{const rr=A*(re*re-im*im)+B*re+C,ri=2*A*re*im+B*im;const denom=Math.abs(A)*(re*re+im*im)+Math.abs(B)*Math.hypot(re,im)+Math.abs(C)||1;return Math.hypot(rr,ri)/denom;});
  return {type:d<0?'complex':d===0?'repeated':'quadratic',co,roots,discriminant:d,scale,residuals};
 }
 function linear(ast,variables){const N=variables.length,zero=()=>Array(N+1).fill(0),constant=a=>a.slice(1).every(v=>v===0);
  function walk(n){if(n.k==='num')return [n.v,...Array(N).fill(0)];if(n.k==='var'){let i=variables.indexOf(n.v);if(i<0)throw Error('Use only '+variables.join(', ')+'.');let r=zero();r[i+1]=1;return r;}if(n.k==='neg')return walk(n.a).map(v=>-v);
   if(n.k==='fn'||n.k==='post'){if(!constant(walk(n.a)))throw Error('Use linear equations without functions of variables.');return [evaluate(n),...Array(N).fill(0)];}
   let a=walk(n.a),b=walk(n.b);if(n.op==='+'||n.op==='-')return a.map((v,i)=>v+(n.op==='+'?1:-1)*b[i]);
   if(n.op==='*'){if(!constant(a)&&!constant(b))throw Error('Products of variables are not linear.');return constant(a)?b.map(v=>v*a[0]):a.map(v=>v*b[0]);}
   if(n.op==='/'){if(!constant(b)||b[0]===0)throw Error('Use a nonzero constant denominator.');return a.map(v=>v/b[0]);}
   if(!constant(b))throw Error('Variable exponents are not supported.');if(b[0]===1)return a;if(b[0]===0)return [1,...Array(N).fill(0)];if(!constant(a))throw Error('Use first-degree variables only.');return [finite(a[0]**b[0]),...Array(N).fill(0)];
  }const out=walk(ast);if(out.some(v=>!Number.isFinite(v)))throw Error('Coefficients are too large.');return out;
 }
 function system(sources){const variables=sources.length===2?['x','y']:['x','y','z'],n=variables.length;
  const original=sources.map(s=>{const [la,ra]=equationParts(s),a=linear(la,variables),b=linear(ra,variables);return [...a.slice(1).map((v,i)=>v-b[i+1]),b[0]-a[0]];});
  const m=original.map(row=>{const s=Math.max(...row.slice(0,n).map(Math.abs))||Math.abs(row[n])||1;return row.map(v=>v/s);}),steps=[];let row=0;const pivots=[];
  for(let col=0;col<n&&row<n;col++){let p=row;for(let i=row+1;i<n;i++)if(Math.abs(m[i][col])>Math.abs(m[p][col]))p=i;if(Math.abs(m[p][col])<1e-12)continue;
   if(p!==row){[m[p],m[row]]=[m[row],m[p]];steps.push({text:`Swap rows ${row+1} and ${p+1}.`,matrix:m.map(r=>[...r])});}
   const pivot=m[row][col];m[row]=m[row].map(v=>v/pivot);steps.push({text:`Divide row ${row+1} by its pivot to make the ${variables[col]} coefficient 1.`,matrix:m.map(r=>[...r])});
   for(let i=0;i<n;i++){if(i===row)continue;const f=m[i][col];if(Math.abs(f)>1e-14){m[i]=m[i].map((v,j)=>v-f*m[row][j]);steps.push({text:`Eliminate ${variables[col]} from row ${i+1}.`,matrix:m.map(r=>[...r])});}}
   pivots.push(col);row++;
  }
  if(m.some(r=>r.slice(0,n).every(v=>Math.abs(v)<1e-10)&&Math.abs(r[n])>1e-10))return {type:'none',steps,original,variables};
  if(row<n)return {type:'infinite',steps,original,variables};let solution=Array(n).fill(0);pivots.forEach((col,i)=>solution[col]=finite(m[i][n]));const residuals=original.map(r=>Math.abs(r.slice(0,n).reduce((s,v,i)=>s+v*solution[i],0)-r[n])/(r.slice(0,n).reduce((s,v,i)=>s+Math.abs(v*solution[i]),0)+Math.abs(r[n])||1));
  return {type:'unique',solution,steps,original,variables,residuals};
 }
 function complex(a,b,op){a=[...a];b=[...b];let re,im;if(op==='+'){re=a[0]+b[0];im=a[1]+b[1];}else if(op==='-'){re=a[0]-b[0];im=a[1]-b[1];}else if(op==='*'){re=a[0]*b[0]-a[1]*b[1];im=a[0]*b[1]+a[1]*b[0];}else {const s=Math.max(Math.abs(b[0]),Math.abs(b[1]));if(s===0)throw Error('Cannot divide by 0 + 0i.');const br=b[0]/s,bi=b[1]/s,d=br*br+bi*bi;re=((a[0]/s)*br+(a[1]/s)*bi)/d;im=((a[1]/s)*br-(a[0]/s)*bi)/d;}return {re:finite(re),im:finite(im),magnitude:finite(Math.hypot(re,im))};}
 const api={parse,evaluate,solve,system,complex};if(typeof module!=='undefined')module.exports=api;root.ACMath=api;
})(typeof window==='undefined'?globalThis:window);
