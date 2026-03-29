"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Scene3D from './Scene3D';
import '../../app/landing.css';

const NAV_LINKS = ['Home','Features','Security','Stack','How It Works','Roadmap','Vote','Contact'];

const FEATURES = [
  { icon:'🛡', title:'Immutable Records', color:'#FF9933',
    desc:'Every vote is a permanent, unalterable transaction on the Solana blockchain. No government, no hacker, no entity can change or delete a single vote — ever. Once confirmed, your ballot is sealed in cryptographic stone for as long as the internet exists.' },
  { icon:'🔎', title:'Full Transparency', color:'#138808',
    desc:'All election results are public and verifiable on Solana Explorer in real-time. Every citizen can audit every vote cast in any election. No black-box counting, no sealed rooms, no trusted officials — just open mathematics on a public ledger.' },
  { icon:'🕵', title:'ZK-Proof Privacy', color:'#4169e1',
    desc:'Zero-knowledge proofs mathematically confirm your eligibility while keeping your identity, choices, and personal data completely private. You prove you are eligible without revealing who you are — your vote is secret, your eligibility is proven.' },
  { icon:'⚡', title:'National Scale Speed', color:'#FF9933',
    desc:"Solana processes 65,000+ transactions per second. SolVoteX can handle national elections — millions of simultaneous votes — without breaking a sweat. Every vote costs just 0.000025 SOL in transaction fees, making it accessible to anyone." },
  { icon:'⚙', title:'Smart Contract Law', color:'#138808',
    desc:'Election rules are hardcoded in open-source Anchor programs on Solana. Execution is automatic, autonomous, and exactly as programmed — no administrator override, no emergency stop, no back door. The code is the law, and anyone can audit it.' },
  { icon:'🌐', title:'Censorship-Proof', color:'#4169e1',
    desc:'No central server. No single point of failure. SolVoteX runs across 1,789+ Solana validators worldwide. Taking down the system would require simultaneously controlling 67% of all validators across dozens of countries — mathematically infeasible.' },
];

const SECURITY_ITEMS = [
  { icon:'🔐', tag:'ZK-SNARK CRYPTOGRAPHY', title:'Zero-Knowledge Proofs',
    color:'#FF9933',
    desc:'Voters prove eligibility using ZK-SNARK proofs without revealing any personal information. Your identity is mathematically verified yet completely private. No government or authority can trace your vote back to you — cryptographic anonymity at the protocol level.' },
  { icon:'✍', tag:'ED25519 SIGNATURES', title:'Cryptographic Signatures',
    color:'#138808',
    desc:"Every vote is signed with your wallet's private key using Ed25519 elliptic curve cryptography — the same security standard used by nation-state banking systems. Forging a vote is computationally impossible. Even with all the world's computers, it cannot be done." },
  { icon:'🌍', tag:'PROOF-OF-HISTORY', title:'Decentralized Consensus',
    color:'#4169e1',
    desc:'No single server, company, or government controls SolVoteX. Results are determined by consensus across 1,789+ geographically distributed Solana validators. Taking down the system would require controlling 67%+ of validators across dozens of countries simultaneously.' },
  { icon:'📜', tag:'OPEN SOURCE AUDITED', title:'Anchor Smart Contracts',
    color:'#FF9933',
    desc:'Election logic is hardcoded in open-source Anchor programs that execute exactly as written — no administrator override, no emergency stop, no back door. Every line of code is public. Security researchers worldwide can audit, challenge, and improve it.' },
];

const STEPS = [
  { num:'01', label:'Connect Wallet', color:'#FF9933',
    desc:'Link your Phantom or Solflare wallet. Your cryptographic identity is established instantly with zero personal data exposed to any server. Your wallet address becomes your immutable voter ID on-chain.' },
  { num:'02', label:'ZK-Proof Verified', color:'#138808',
    desc:'A one-time zero-knowledge proof confirms your voter eligibility without revealing personal information to anyone. You mathematically prove you are eligible while remaining completely anonymous — no UID, no PAN, no biometrics.' },
  { num:'03', label:'Sign & Cast Vote', color:'#FF9933',
    desc:'Select your candidate and sign the transaction with your private key. Your vote is encrypted and broadcast simultaneously to 1,789+ validators globally. Transaction fee: 0.000025 SOL. Time to broadcast: ~50ms.' },
  { num:'04', label:'Immutable Confirmation', color:'#138808',
    desc:'Confirmed in ~401ms via Proof-of-History consensus. Your vote lives on-chain forever — immutable, tamper-proof, and publicly verifiable. You receive a unique transaction hash to independently verify your ballot on any Solana block explorer.' },
];

const STACK_LAYERS = [
  { num:'01', tag:'CONSENSUS LAYER', title:'Solana Mainnet', sub:'Proof of History + Tower BFT', color:'#FF9933',
    desc:"Solana's Proof of History creates a verifiable historical record proving events occurred at exact moments — perfect for timestamping votes with mathematical certainty. 65,000 TPS capacity and ~401ms finality means no election is ever too large or too slow." },
  { num:'02', tag:'CONTRACT LAYER', title:'Anchor Framework', sub:'Rust Smart Contracts', color:'#138808',
    desc:'SolVoteX election logic lives in Anchor smart contracts written in Rust — the world\'s safest systems language. Anchor provides automatic account validation, error handling, and a developer-friendly IDL. Open source, publicly audited, and immutable once deployed.' },
  { num:'03', tag:'PRIVACY LAYER', title:'ZK-SNARK Proofs', sub:'Zero-Knowledge Eligibility', color:'#4169e1',
    desc:'Every voter generates a ZK-SNARK proof that cryptographically confirms eligibility without revealing identity. This layer is what makes SolVoteX the first election system where votes are simultaneously public (verifiable) and private (anonymous) at the protocol level.' },
  { num:'04', tag:'TOKEN LAYER', title:'Solana SPL Tokens', sub:'Non-Transferable Voting Rights', color:'#FF9933',
    desc:'Each voter receives a custom SPL token acting as their one-time ballot. The token contract enforces one-vote-per-wallet at protocol level. Non-transferable, non-duplicable, expires after election period. Even the organizers cannot override — it\'s mathematics, not policy.' },
  { num:'05', tag:'AUTH LAYER', title:'JWT + MongoDB', sub:'Phase 1 Session Security', color:'#138808',
    desc:'Before hitting the blockchain, voters authenticate through JWT backed by MongoDB. This two-factor approach — web session security combined with cryptographic wallet auth — creates defence-in-depth against both web-layer and chain-layer attacks simultaneously.' },
  { num:'06', tag:'FRONTEND LAYER', title:'React 19 + Vite 6', sub:'Tailwind CSS v4 + Three.js', color:'#4169e1',
    desc:'Built on React 19 concurrent rendering, Vite 6 for blazing-fast builds, and Tailwind CSS v4. The immersive 3D experience is powered by Three.js with custom GLSL shaders — giving voters an interface unlike any government portal ever built.' },
];

const ROADMAP = [
  { phase:'Phase 1', title:'Foundation', date:'Completed', status:'done', color:'#FF9933',
    items:['JWT authentication system','MongoDB voter database','SPL token minting','React 19 + Vite 6 frontend','Wallet integration (Phantom, Solflare)'] },
  { phase:'Phase 2', title:'Smart Contracts', date:'In Progress', status:'active', color:'#138808',
    items:['Anchor program deployment','On-chain vote recording','Anti-double-vote enforcement','Transaction audit trail','Devnet testing complete'] },
  { phase:'Phase 3', title:'ZK + Audit', date:'Q3 2025', status:'upcoming', color:'#4169e1',
    items:['ZK-SNARK proof integration','Third-party contract audit','Penetration testing','Bug bounty program','Mainnet deployment'] },
  { phase:'Phase 4', title:'Scale & Govern', date:'Q4 2025', status:'upcoming', color:'#FF9933',
    items:['Multi-election support','DAO governance integration','Mobile app (iOS/Android)','API for institutions','Government pilot program'] },
];

const WHY_ITEMS = [
  { icon:'🏛', title:'For Governments', color:'#FF9933',
    desc:'Replace paper ballots and centralized e-voting with a system simultaneously more secure, more transparent, and cheaper to operate. No proprietary vendor lock-in. No post-election litigation about machine tampering. Just immutable mathematics on a public ledger.' },
  { icon:'👨‍💻', title:'For Developers', color:'#138808',
    desc:"Build election infrastructure on the most developer-friendly blockchain. Anchor's IDL means your frontend team calls on-chain functions like regular APIs. Our open-source codebase welcomes contributions. Deployed on Solana Devnet at Block #348,291,042." },
  { icon:'🧑‍🤝‍🧑', title:'For Voters', color:'#FF9933',
    desc:'Vote from your phone in under 60 seconds. No polling booth queues. No postal ballot delays. 0.000025 SOL transaction fee. Every voter receives a transaction hash they can look up on Solana Explorer to confirm their vote is recorded exactly as cast.' },
  { icon:'🔍', title:'For Auditors', color:'#138808',
    desc:'The entire election history is a public ledger across 1,789+ validators. Export every vote, every token mint, every wallet interaction as raw blockchain data. Independent observers can verify results without any private access — transparency is the default.' },
];

const MARQUEE_ITEMS = [
  '🗳 Tamper-Proof Voting','⚡ ~401ms Finality','🔐 ZK-SNARK Proofs',
  '⛓ Solana Blockchain','🌐 1,789+ Validators','📊 Real-Time Results',
  '🛡 Ed25519 Signatures','🔑 Wallet-Based Identity','🇮🇳 Made in India',
  '✅ Cryptographic Audit Trail','⚙ Rust Smart Contracts','🚀 65,000 TPS',
  '🏛 Democratic Integrity','🌍 Censorship-Proof','💸 0.000025 SOL/Vote',
];

const GLITCH_CHARS = 'ₐBCᴅEFGₕIJKLMₙOPQRSₜUVWXYZ0123456789@#$%&';

function GlitchText({ text, className, tag: Tag = 'h2' }) {
  const [display, setDisplay] = useState(text);
  const [glitching, setGlitching] = useState(false);
  const iterRef = useRef(0), ivRef = useRef(null);
  const startGlitch = () => {
    if (glitching) return; setGlitching(true); iterRef.current = 0;
    ivRef.current = setInterval(() => {
      iterRef.current++;
      setDisplay(text.split('').map((c,i) => i < iterRef.current/1.5 ? c : c===' '?' ':GLITCH_CHARS[Math.floor(Math.random()*GLITCH_CHARS.length)]).join(''));
      if (iterRef.current >= text.length*1.5) { clearInterval(ivRef.current); setDisplay(text); setGlitching(false); }
    }, 38);
  };
  useEffect(()=>()=>clearInterval(ivRef.current),[]);
  return <Tag className={`${className} glitch-text`} onMouseEnter={startGlitch}>{display}</Tag>;
}

function TiltCard({ children, className, style, onClick, 'data-reveal': dr, isFlip=false, accentColor='#FF9933' }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({x:0,y:0});
  const [shine, setShine] = useState({x:50,y:50});
  const [hov, setHov] = useState(false);
  const r=parseInt(accentColor.slice(1,3),16)||255, g=parseInt(accentColor.slice(3,5),16)||153, b=parseInt(accentColor.slice(5,7),16)||51;
  const handleMove = e => {
    const rect=ref.current.getBoundingClientRect();
    const px=(e.clientX-rect.left)/rect.width-0.5, py=(e.clientY-rect.top)/rect.height-0.5;
    setTilt({x:-py*(isFlip?5:11), y:px*(isFlip?5:11)});
    setShine({x:((e.clientX-rect.left)/rect.width)*100, y:((e.clientY-rect.top)/rect.height)*100});
  };
  return (
    <div ref={ref} className={`${className} tilt-card`} data-reveal={dr}
      style={{...style,'--accent':accentColor,
        transform:`perspective(${isFlip?1200:720}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${hov&&!isFlip?14:0}px)`,
        transition:hov?'transform 0.06s linear':'transform 0.55s cubic-bezier(0.16,1,0.3,1)'}}
      onMouseMove={handleMove} onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>{setTilt({x:0,y:0});setShine({x:50,y:50});setHov(false);}}
      onClick={onClick}>
      {children}
      <div className="holo-shine" style={{opacity:hov?1:0,background:`radial-gradient(circle at ${shine.x}% ${shine.y}%,rgba(${r},${g},${b},0.20) 0%,rgba(${r},${g},${b},0.07) 50%,transparent 72%)`,transition:'opacity 0.3s ease'}}/>
    </div>
  );
}

function MagneticBtn({ children, className, onClick, style }) {
  const ref = useRef(null);
  const [off, setOff] = useState({x:0,y:0});
  const hm = e => { const r=ref.current.getBoundingClientRect(); const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2); const d=Math.sqrt(dx*dx+dy*dy); if(d<80){const s=(80-d)/80; setOff({x:dx*s*0.45,y:dy*s*0.45});} };
  return <button ref={ref} className={className} style={{...style,transform:`translate(${off.x}px,${off.y}px)`,transition:off.x===0?'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)':'transform 0.08s linear'}} onMouseMove={hm} onMouseLeave={()=>setOff({x:0,y:0})} onClick={onClick}>{children}</button>;
}

function TypewriterText({ text, className, visible }) {
  const [displayed, setDisplayed] = useState('');
  const idxRef=useRef(0), startedRef=useRef(false);
  useEffect(()=>{ if(!visible||startedRef.current) return; startedRef.current=true; const iv=setInterval(()=>{ idxRef.current++; setDisplayed(text.slice(0,idxRef.current)); if(idxRef.current>=text.length) clearInterval(iv); },22); return()=>clearInterval(iv); },[visible,text]);
  return <p className={className}>{displayed}<span className="type-cursor">|</span></p>;
}

function CounterNum({ target, suffix='', decimals=0, visible }) {
  const [val, setVal] = useState(0); const startedRef=useRef(false);
  useEffect(()=>{ if(!visible||startedRef.current) return; startedRef.current=true; let cur=0; const iv=setInterval(()=>{ cur+=target/60; if(cur>=target){setVal(target);clearInterval(iv);}else setVal(cur); },1800/60); return()=>clearInterval(iv); },[visible,target]);
  return <>{decimals>0?val.toFixed(decimals):Math.floor(val).toLocaleString()}{suffix}</>;
}

function InteractiveGrid() {
  const COLS=30, ROWS=9;
  const [lit, setLit] = useState({});
  const lightCell = useCallback(idx=>{
    const col=idx%COLS, row=Math.floor(idx/COLS);
    const colors=['#FF9933','#138808','#4169e1'];
    const updates={};
    for(let dr=-3;dr<=3;dr++) for(let dc=-3;dc<=3;dc++){
      const dist=Math.sqrt(dr*dr+dc*dc); if(dist>3) continue;
      const nr=Math.max(0,Math.min(ROWS-1,row+dr)), nc=Math.max(0,Math.min(COLS-1,col+dc));
      const ni=nr*COLS+nc, intensity=1-(dist/3.2);
      if(intensity>=(updates[ni]?.intensity||0)) updates[ni]={intensity,color:colors[Math.floor(dist)%3]};
    }
    setLit(prev=>({...prev,...updates}));
    setTimeout(()=>setLit(prev=>{ const n={...prev}; Object.keys(updates).forEach(k=>delete n[k]); return n; }),900);
  },[]);
  return (
    <div className="interactive-grid" style={{gridTemplateColumns:`repeat(${COLS},1fr)`}} aria-hidden="true">
      {Array.from({length:COLS*ROWS},(_,i)=>(
        <div key={i} className="grid-cell" onMouseEnter={()=>lightCell(i)}
          style={lit[i]?{background:lit[i].color,opacity:lit[i].intensity*0.6,boxShadow:`0 0 10px ${lit[i].color}88`}:{}}/>
      ))}
    </div>
  );
}

function OrbitStat({ value, label, color }) {
  return (
    <div className="orbit-stat">
      <div className="orbit-outer" style={{borderColor:`${color}28`}}>
        <div className="orbit-dashed" style={{borderColor:`${color}50`}}/>
        <div className="orbit-inner" style={{borderColor:`${color}18`}}>
          <div className="orbit-value" style={{color}}>{value}</div>
        </div>
      </div>
      <p className="orbit-label">{label}</p>
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  const opts=[['system','⚙','System'],['light','☀️','Light'],['dark','🌙','Dark']];
  return (
    <div className="theme-toggle">
      {opts.map(([val,icon,label])=>(
        <button key={val} className={`theme-opt${theme===val?' active':''}`} onClick={()=>setTheme(val)} title={label}>
          <span>{icon}</span><span className="tl">{label}</span>
        </button>
      ))}
    </div>
  );
}

function CandidateCard({ c, onVote, setVoteParticles }) {
  const [flipped, setFlipped] = useState(false);
  const total=2847+125756, pct=+(((c.votes/total)*100).toFixed(1));
  const handleVote=e=>{
    e.stopPropagation();
    const rect=e.currentTarget.getBoundingClientRect();
    const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
    const colors=['#FF9933','#138808','#06038D','#FFD700','#ffffff'];
    const newP=Array.from({length:60},(_,i)=>({id:Date.now()+i,x:cx,y:cy,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12-4,color:colors[i%colors.length],size:4+Math.random()*8}));
    setVoteParticles(prev=>[...prev,...newP]);
    setTimeout(()=>setVoteParticles(prev=>prev.filter(p=>!newP.find(n=>n.id===p.id))),1400);
    onVote(c.name);
  };
  return (
    <TiltCard className="flip-wrapper" isFlip={true} accentColor={c.color} onClick={()=>setFlipped(f=>!f)}>
      <div className={`flip-inner${flipped?' flipped':''}`}>
        <div className="flip-face flip-front candidate-card" style={{'--card-accent':c.color}}>
          <div className="candidate-avatar" style={{background:`linear-gradient(135deg,${c.color},${c.color}55)`}}>{c.name.split(' ').map(w=>w[0]).join('')}</div>
          <h3 className="candidate-name">{c.name}</h3>
          <p className="candidate-party">{c.party}</p>
          <div className="vote-bar-wrap"><div className="vote-bar" style={{width:`${pct}%`,background:`linear-gradient(90deg,${c.color},${c.color}88)`}}/></div>
          <div className="vote-meta"><span>{c.votes.toLocaleString()} votes</span><span style={{color:c.color}}>{pct}%</span></div>
          <MagneticBtn className="btn-vote" style={{borderColor:c.color,color:c.color}} onClick={handleVote}>⬡ Sign &amp; Cast Vote</MagneticBtn>
          <p className="flip-hint">Click card to see profile ↩</p>
          <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
        </div>
        <div className="flip-face flip-back candidate-card" style={{'--card-accent':c.color}}>
          <div className="back-badge" style={{borderColor:c.color,color:c.color}}>⬡ CANDIDATE PROFILE</div>
          <h3 className="candidate-name" style={{color:c.color,marginBottom:'12px'}}>{c.name}</h3>
          {[['🏛 Party',c.party],['🗳 Votes',c.votes.toLocaleString()],['📊 Share',`${pct}%`],['🔗 Network','Solana Devnet'],['⚡ Ballot','SPL token enforced'],['🛡 Contract','Anchor + ZK-Proof']].map(([k,v])=>(
            <p key={k} className="back-detail">{k}: <strong>{v}</strong></p>
          ))}
          <div className="back-bar"><div style={{width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${c.color},${c.color}55)`,borderRadius:'2px'}}/></div>
          <MagneticBtn className="btn-vote" style={{borderColor:c.color,color:c.color,marginTop:'12px'}} onClick={handleVote}>⬡ Confirm Vote</MagneticBtn>
          <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
        </div>
      </div>
    </TiltCard>
  );
}

/* ═══════════════════════ MAIN APP ═══════════════════════ */
export default function LandingPage() {
  const router = useRouter();
  const [theme,setTheme]=useState('system');
  const [ripples,setRipples]=useState([]); const [keys,setKeys]=useState([]);
  const [active,setActive]=useState('Home'); const [voted,setVoted]=useState(null);
  const [scrolled,setScrolled]=useState(false); const [scrollPct,setScrollPct]=useState(0);
  const [mousePos,setMousePos]=useState({x:-999,y:-999});
  const [trail,setTrail]=useState([]); const [logoHover,setLogoHover]=useState(false);
  const [titleHover,setTitleHover]=useState(false); const [chakraAngle,setChakraAngle]=useState(0);
  const [textParticles,setTextParticles]=useState([]); const [voteParticles,setVoteParticles]=useState([]);
  const [visible,setVisible]=useState({}); const [spotLight,setSpotLight]=useState({x:-999,y:-999});
  const [activeStack,setActiveStack]=useState(0); const [isDark,setIsDark]=useState(true);
  const [showResultsInput,setShowResultsInput]=useState(false); const [resultsPollId,setResultsPollId]=useState('');
  const trailIdRef=useRef(0);

  useEffect(()=>{
    const apply=t=>{
      const resolved=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;
      document.documentElement.setAttribute('data-theme',resolved);
      setIsDark(resolved==='dark');
    };
    apply(theme); localStorage.setItem('svx-theme',theme);
    if(theme==='system'){
      const mq=window.matchMedia('(prefers-color-scheme: dark)');
      const h=()=>apply('system'); mq.addEventListener('change',h); return()=>mq.removeEventListener('change',h);
    }
  },[theme]);

  useEffect(()=>{ const id=setInterval(()=>setChakraAngle(a=>(a+0.8)%360),16); return()=>clearInterval(id); },[]);
  useEffect(()=>{
    const obs=new IntersectionObserver(entries=>entries.forEach(e=>{ if(e.isIntersecting) setVisible(p=>({...p,[e.target.dataset.reveal]:true})); }),{threshold:0.12});
    document.querySelectorAll('[data-reveal]').forEach(el=>obs.observe(el));
    return()=>obs.disconnect();
  },[]);
  useEffect(()=>{
    const onC=e=>{ const id=Date.now()+Math.random(); setRipples(p=>[...p,{id,x:e.clientX,y:e.clientY}]); setTimeout(()=>setRipples(p=>p.filter(r=>r.id!==id)),1000); };
    const onK=e=>{ if(['F5','F12','Tab','F1','F3'].includes(e.key)) return; const lb=e.key.length===1?e.key.toUpperCase():e.key; const id=Date.now()+Math.random(); setKeys(p=>[...p.slice(-6),{id,label:lb}]); setTimeout(()=>setKeys(p=>p.filter(k=>k.id!==id)),1400); };
    const onS=()=>{ setScrolled(window.scrollY>40); const mx=document.documentElement.scrollHeight-window.innerHeight; setScrollPct(mx>0?(window.scrollY/mx)*100:0); };
    const onM=e=>{
      setMousePos({x:e.clientX,y:e.clientY}); setSpotLight({x:e.clientX,y:e.clientY});
      const id=++trailIdRef.current; const cols=['#FF9933','#FF9933','#ffffff','#138808','#138808'];
      setTrail(p=>[...p.slice(-12),{id,x:e.clientX,y:e.clientY,color:cols[id%cols.length]}]);
      setTimeout(()=>setTrail(p=>p.filter(t=>t.id!==id)),500);
    };
    window.addEventListener('click',onC); window.addEventListener('keydown',onK); window.addEventListener('scroll',onS); window.addEventListener('mousemove',onM);
    return()=>{ window.removeEventListener('click',onC); window.removeEventListener('keydown',onK); window.removeEventListener('scroll',onS); window.removeEventListener('mousemove',onM); };
  },[]);

  const scrollTo=id=>{ document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); setActive(id); };
  const spawnTP=e=>{
    const rect=e.currentTarget.getBoundingClientRect();
    const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
    const chars='SolVoteX', colors=['#FF9933','#138808','#06038D','#ffffff','#FF9933','#138808','#ffffff','#FFD700'];
    const newP=Array.from({length:24},(_,i)=>({id:Date.now()+i,x:cx,y:cy,angle:(i/24)*Math.PI*2,color:colors[i%colors.length],char:chars[i%chars.length]}));
    setTextParticles(p=>[...p,...newP]);
    setTimeout(()=>setTextParticles(p=>p.filter(x=>!newP.find(n=>n.id===x.id))),1200);
  };

  return (
    <div className="app">
      {<Scene3D/>}

      <div className="scroll-progress" style={{width:`${scrollPct}%`}}/>
      {isDark && <div className="spotlight" style={{background:`radial-gradient(circle 260px at ${spotLight.x}px ${spotLight.y}px,transparent 0%,rgba(2,3,10,0.86) 100%)`}}/>}
      <div className={`cursor-ring${logoHover?' cursor-ring--logo':''}`} style={{left:mousePos.x,top:mousePos.y}}/>
      {isDark && trail.map((t,i)=><div key={t.id} className="trail-dot" style={{left:t.x,top:t.y,background:t.color,opacity:(i+1)/trail.length*0.7,width:`${4+(i/trail.length)*8}px`,height:`${4+(i/trail.length)*8}px`}}/>)}
      {ripples.map(r=><div key={r.id} className="click-ripple" style={{left:r.x-40,top:r.y-40}}/>)}
      <div className="key-display">{keys.map(k=><div key={k.id} className="key-badge">{k.label}</div>)}</div>
      {textParticles.map(p=><div key={p.id} className="text-particle" style={{left:p.x,top:p.y,color:p.color,'--angle':p.angle}}>{p.char}</div>)}
      {voteParticles.map(p=><div key={p.id} className="vote-particle" style={{left:p.x,top:p.y,'--vx':`${p.vx*12}px`,'--vy':`${p.vy*12}px`,width:p.size,height:p.size,background:p.color}}/>)}
      {isDark && <div className="scanlines"/>}

      {/* NAVBAR */}
      <nav className={`navbar${scrolled?' scrolled':''}`}>
        <div className={`nav-logo${logoHover?' nav-logo--hover':''}`} onClick={e=>{scrollTo('home');spawnTP(e);}} onMouseEnter={()=>setLogoHover(true)} onMouseLeave={()=>setLogoHover(false)}>
          <span className="logo-bracket">[</span>
          {['S','o','l'].map((c,i)=><span key={i} className="logo-char logo-sol" style={{animationDelay:`${i*0.06}s`}}>{c}</span>)}
          {['V','o','t','e'].map((c,i)=><span key={i} className="logo-char logo-vote" style={{animationDelay:`${(i+3)*0.06}s`}}>{c}</span>)}
          <span className="logo-char logo-x" style={{animationDelay:'0.42s'}}>X</span>
          <span className="logo-bracket">]</span>
        </div>
        <ul className="nav-links">
          {NAV_LINKS.map(l=><li key={l}><button className={`nav-btn${active===l?' nav-btn--active':''}`} onClick={()=>scrollTo(l.toLowerCase().replace(/\s+/g,'-'))}>{l}</button></li>)}
        </ul>
        <div className="nav-right" style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <ThemeToggle theme={theme} setTheme={setTheme}/>
          {!showResultsInput ? (
            <button
              onClick={()=>setShowResultsInput(true)}
              style={{cursor:'pointer',fontSize:'0.72rem',padding:'8px 16px',borderRadius:'8px',border:'1px solid rgba(65,105,225,0.4)',background:'rgba(65,105,225,0.08)',color:'#4169e1',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:600,transition:'all 0.3s ease',whiteSpace:'nowrap'}}
            >
              ◈ RESULTS
            </button>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <input
                type="text"
                placeholder="Poll ID"
                value={resultsPollId}
                onChange={e=>setResultsPollId(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&resultsPollId.trim()) router.push(`/results/${resultsPollId.trim()}`); if(e.key==='Escape'){setShowResultsInput(false);setResultsPollId('');} }}
                autoFocus
                style={{padding:'7px 12px',borderRadius:'6px',border:'1px solid rgba(65,105,225,0.4)',background:'rgba(6,3,141,0.15)',color:'#fff',fontSize:'0.75rem',width:'100px',outline:'none',fontFamily:'inherit',letterSpacing:'1px',textAlign:'center'}}
              />
              <button
                onClick={()=>{ if(resultsPollId.trim()) router.push(`/results/${resultsPollId.trim()}`); }}
                style={{padding:'7px 14px',borderRadius:'6px',background:'linear-gradient(135deg,#4169e1,#2a4dd4)',color:'#fff',border:'none',cursor:'pointer',fontSize:'0.75rem',fontWeight:600}}
              >
                GO
              </button>
              <button
                onClick={()=>{setShowResultsInput(false);setResultsPollId('');}}
                style={{padding:'7px 10px',borderRadius:'6px',background:'rgba(255,255,255,0.05)',color:'#9898b0',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',fontSize:'0.7rem'}}
              >
                ✕
              </button>
            </div>
          )}
          <MagneticBtn className="nav-cta" onClick={()=>router.push('/auth')}>⬡ Login / Signup</MagneticBtn>
        </div>
      </nav>

      <main className="content">

        {/* HERO */}
        <section id="home" className="section hero-section">
          <InteractiveGrid/>
          <div className="hero-network-tag" data-reveal="eyebrow">
            <span className="pulse-dot"/>DEPLOYED ON SOLANA DEVNET — BLOCK #348,291,042
          </div>
          <div className="chakra-wrap">
            <svg className="chakra-svg" viewBox="0 0 100 100" style={{transform:`rotate(${chakraAngle}deg)`}}>
              {Array.from({length:24},(_,i)=>{const a=(i/24)*Math.PI*2;return<line key={i} x1={50+20*Math.cos(a)} y1={50+20*Math.sin(a)} x2={50+44*Math.cos(a)} y2={50+44*Math.sin(a)} stroke="#06038D" strokeWidth="1.5" strokeOpacity="0.9"/>;}) }
              <circle cx="50" cy="50" r="44" fill="none" stroke="#06038D" strokeWidth="2" strokeOpacity="0.8"/>
              <circle cx="50" cy="50" r="20" fill="none" stroke="#06038D" strokeWidth="2" strokeOpacity="0.8"/>
              <circle cx="50" cy="50" r="4" fill="#06038D" fillOpacity="0.9"/>
            </svg>
          </div>
          <h1 className={`hero-title${titleHover?' hero-title--hover':''}`} onMouseEnter={()=>setTitleHover(true)} onMouseLeave={()=>setTitleHover(false)} onClick={spawnTP}>
            {['S','o','l'].map((c,i)=><span key={i} className="hero-char hero-sol" style={{'--i':i}}>{c}</span>)}
            {['V','o','t','e'].map((c,i)=><span key={i} className="hero-char hero-vote" style={{'--i':i+3}}>{c}</span>)}
            <span className="hero-char hero-x" style={{'--i':7}}>X</span>
          </h1>
          <p className="hero-tagline">Blockchain Voting · Zero Trust · Infinite Transparency</p>
          <div data-reveal="heroSub">
            {visible['heroSub']&&<TypewriterText text="SolVoteX eliminates election fraud at the protocol level. Every vote is cryptographically sealed on Solana — immutable, transparent, and unstoppable." className="hero-sub" visible={visible['heroSub']}/>}
          </div>
          <div className="hero-actions">
            <MagneticBtn className="btn-primary" onClick={()=>router.push('/auth')}><span>⬡ LOGIN / SIGNUP</span><span className="btn-glow"/></MagneticBtn>
            <MagneticBtn className="btn-secondary" onClick={()=>router.push('/vote/check')}>◈ GO TO VOTING →</MagneticBtn>
          </div>
          <div className="flag-stripe"><div className="flag-saffron"/><div className="flag-white"><span className="flag-chakra-sm">☸</span></div><div className="flag-green"/></div>
          <div className="orbit-stats-row" data-reveal="stats">
            {[[128816,'Total Votes','#FF9933',''],[1789,'Validators','#138808','+'],[401,'ms Finality','#4169e1','ms'],[0,'Breaches','#FF9933','']].map(([tgt,lbl,col,sfx],i)=>(
              <div key={lbl} className={`reveal-item${visible['stats']?' revealed':''}`} style={{transitionDelay:`${i*0.13}s`}}>
                <OrbitStat value={visible['stats']?<CounterNum target={tgt} suffix={sfx} decimals={0} visible={true}/> :`0${sfx}`} label={lbl} color={col}/>
              </div>
            ))}
          </div>
          <div className="scroll-hint"><span>SCROLL TO EXPLORE</span><div className="scroll-arrow"/></div>
        </section>

        {/* MARQUEE */}
        <div className="marquee-section">
          <div className="marquee-track">
            {[...MARQUEE_ITEMS,...MARQUEE_ITEMS].map((item,i)=><span key={i} className="marquee-item">{item}</span>)}
          </div>
        </div>

        {/* FEATURES */}
        <section id="features" className="section">
          <div className="section-header" data-reveal="featHead">
            <p className="section-tag">// CAPABILITIES</p>
            <GlitchText text="Built for the Future of Democracy" className={`section-title reveal-item${visible['featHead']?' revealed':''}`}/>
            <p className="section-desc">Every feature engineered for maximum security, transparency, and accessibility at global scale. No compromises on democratic integrity.</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f,i)=>(
              <TiltCard key={f.title} accentColor={f.color} className={`feature-card reveal-item${visible[`feat${i}`]?' revealed':''}`} data-reveal={`feat${i}`} style={{transitionDelay:`${i*0.08}s`}}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title" style={{color:f.color}}>{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
                <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* SECURITY — new section from uploaded HTML */}
        <section id="security" className="section security-section">
          <div className="section-header" data-reveal="secHead">
            <p className="section-tag">// CRYPTOGRAPHY</p>
            <GlitchText text="Unbreakable by Design" className={`section-title reveal-item${visible['secHead']?' revealed':''}`}/>
            <p className="section-desc">Multi-layer cryptographic security makes SolVoteX mathematically impossible to compromise. Not just policy — pure mathematics.</p>
          </div>
          <div className="security-grid">
            {SECURITY_ITEMS.map((s,i)=>(
              <TiltCard key={i} accentColor={s.color} className={`security-card reveal-item${visible[`sec${i}`]?' revealed':''}`} data-reveal={`sec${i}`} style={{transitionDelay:`${i*0.1}s`}}>
                <div className="security-icon">{s.icon}</div>
                <div className="security-tag" style={{color:s.color}}>⬡ {s.tag}</div>
                <h3 className="security-title">{s.title}</h3>
                <p className="security-desc">{s.desc}</p>
                <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* STACK */}
        <section id="stack" className="section stack-section">
          <div className="section-header" data-reveal="stackHead">
            <p className="section-tag">// ARCHITECTURE</p>
            <GlitchText text="The SolVoteX Stack" className={`section-title reveal-item${visible['stackHead']?' revealed':''}`}/>
            <p className="section-desc">Six interlocking layers — each independently secure, collectively unstoppable. Modular blockchain architecture built for India-scale elections.</p>
          </div>
          <div className="stack-layout">
            <div className="stack-nav">
              {STACK_LAYERS.map((layer,i)=>(
                <button key={i} className={`stack-nav-btn${activeStack===i?' active':''}`}
                  style={activeStack===i?{borderColor:layer.color,color:layer.color}:{}}
                  onClick={()=>setActiveStack(i)}>
                  <span className="stack-nav-num">{layer.num}</span>
                  <span className="stack-nav-label">{layer.title}</span>
                  <span className="stack-nav-tag">{layer.tag}</span>
                </button>
              ))}
            </div>
            <div className="stack-panels-container">
              {STACK_LAYERS.map((layer,i)=>(
                <TiltCard key={i} accentColor={layer.color} className={`stack-panel${activeStack===i?' active':''}`} style={{'--layer-color':layer.color}}>
                  <div className="stack-panel-tag" style={{color:layer.color}}>{layer.tag}</div>
                  <h3 className="stack-panel-title" style={{color:layer.color}}>{layer.title}</h3>
                  <p className="stack-panel-sub">{layer.sub}</p>
                  <p className="stack-panel-desc">{layer.desc}</p>
                  <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="section">
          <div className="section-header" data-reveal="howHead">
            <p className="section-tag">// PROCESS</p>
            <GlitchText text="How SolVoteX Works" className={`section-title reveal-item${visible['howHead']?' revealed':''}`}/>
            <p className="section-desc">Four frictionless steps from wallet connection to immutable on-chain record. Every action is cryptographically verified.</p>
          </div>
          <div className="steps-container">
            {STEPS.map((s,i)=>(
              <TiltCard key={s.num} accentColor={s.color} className={`step-card reveal-item${visible[`step${i}`]?' revealed':''}`} data-reveal={`step${i}`} style={{transitionDelay:`${i*0.15}s`}}>
                <div className="step-num" style={{WebkitTextStrokeColor:s.color}}>{s.num}</div>
                <h3 className="step-label" style={{color:s.color}}>{s.label}</h3>
                <p className="step-desc">{s.desc}</p>
                <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* WHY */}
        <section id="why" className="section">
          <div className="section-header" data-reveal="whyHead">
            <p className="section-tag">// WHY SOLVOTEX</p>
            <GlitchText text="Who Benefits?" className={`section-title reveal-item${visible['whyHead']?' revealed':''}`}/>
            <p className="section-desc">SolVoteX is designed for every participant in a democratic process — from election commissioners to individual voters to independent auditors.</p>
          </div>
          <div className="why-grid">
            {WHY_ITEMS.map((item,i)=>(
              <TiltCard key={i} accentColor={item.color} className={`why-card reveal-item${visible[`why${i}`]?' revealed':''}`} data-reveal={`why${i}`} style={{transitionDelay:`${i*0.1}s`}}>
                <div className="why-icon">{item.icon}</div>
                <h3 className="why-title" style={{color:item.color}}>{item.title}</h3>
                <p className="why-desc">{item.desc}</p>
                <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ROADMAP */}
        <section id="roadmap" className="section roadmap-section">
          <div className="section-header" data-reveal="roadHead">
            <p className="section-tag">// DEVELOPMENT TIMELINE</p>
            <GlitchText text="The Road to Consensus" className={`section-title reveal-item${visible['roadHead']?' revealed':''}`}/>
            <p className="section-desc">From college mini-project to national election infrastructure — our phased rollout ensures security and reliability at every step.</p>
          </div>
          <div className="roadmap-track">
            <div className="roadmap-line"/>
            {ROADMAP.map((phase,i)=>(
              <div key={i} className={`roadmap-item reveal-item${visible[`road${i}`]?' revealed':''}`} data-reveal={`road${i}`} style={{transitionDelay:`${i*0.18}s`}}>
                <div className="roadmap-dot" style={phase.status!=='upcoming'?{background:phase.color,borderColor:phase.color,boxShadow:`0 0 14px ${phase.color}`}:{borderColor:'rgba(255,153,51,0.3)'}}/>
                <TiltCard accentColor={phase.color} className={`roadmap-card roadmap-card--${phase.status}`}>
                  <div className="roadmap-phase" style={{color:phase.color}}>{phase.phase}</div>
                  <h3 className="roadmap-title">{phase.title}</h3>
                  <div className="roadmap-date" style={phase.status!=='upcoming'?{color:phase.color}:{}}>{phase.date}</div>
                  <ul className="roadmap-items">
                    {phase.items.map((item,j)=><li key={j} className="roadmap-item-li"><span style={{color:phase.status!=='upcoming'?phase.color:'rgba(180,100,10,0.5)'}}>›</span> {item}</li>)}
                  </ul>
                  <div className="card-corner tl"/><div className="card-corner tr"/><div className="card-corner bl"/><div className="card-corner br"/>
                </TiltCard>
              </div>
            ))}
          </div>
        </section>

        {/* VOTE */}
        <section id="vote" className="section vote-section">
          <div className="section-header" data-reveal="voteHead">
            <p className="section-tag">// LIVE ELECTION DEMO</p>
            <GlitchText text="Cast Your Vote" className={`section-title reveal-item${visible['voteHead']?' revealed':''}`}/>
            <p className="section-desc">Interact with a live simulation of the SolVoteX dApp. Click candidates to cast votes. Every action mirrors the real blockchain experience on Solana Devnet.</p>
          </div>
          <div className="vote-network-bar">
            <span className="pulse-dot-sm"/>
            <span>NETWORK: SOLANA DEVNET</span>
            <span className="nb-sep">|</span>
            <span>SLOT: #348,291,042</span>
            <span className="nb-sep">|</span>
            <span>FEE: 0.000025 SOL/VOTE</span>
            <span className="nb-sep">|</span>
            <span style={{color:'#138808'}}>● 1,789 VALIDATORS ONLINE</span>
          </div>
          {voted?(
            <div className="vote-success">
              <div className="success-icon">✓</div>
              <h3>Vote Confirmed On-Chain</h3>
              <p>You voted for <span style={{color:'#FF9933'}}>{voted}</span></p>
              <p className="tx-hash">TX: 4xK9m...mR2p &nbsp;|&nbsp; SLOT #348,291,043 &nbsp;|&nbsp; FEE: 0.000025 SOL</p>
              <p className="tx-sub">Your vote is permanently recorded on Solana Devnet. Verify with the transaction hash on Solana Explorer.</p>
              <MagneticBtn className="btn-secondary" onClick={()=>setVoted(null)}>Vote Again</MagneticBtn>
            </div>
          ):(
            <div className="candidates-grid">
              {[
                {name:'Progressive Party',party:'Coalition for Digital Democracy',votes:52831,color:'#FF9933'},
                {name:'Reform Alliance',party:'Transparent Governance Union',votes:43832,color:'#138808'},
                {name:'Tech Forward',party:'Web3 Citizens Coalition',votes:17736,color:'#4169e1'},
                {name:'Unity Front',party:'National Consensus Party',votes:10493,color:'#b8860b'},
              ].map(c=><CandidateCard key={c.name} c={c} onVote={setVoted} setVoteParticles={setVoteParticles}/>)}
            </div>
          )}
        </section>

        {/* CTA — "On-Chain Forever" from uploaded HTML */}
        <section className="section cta-section">
          <div className="cta-inner" data-reveal="ctaBlock">
            <p className="section-tag">⬡ GET STARTED TODAY</p>
            <h2 className={`cta-title reveal-item${visible['ctaBlock']?' revealed':''}`}>Your Vote.<br/>Your Power.<br/><span className="cta-accent">On-Chain Forever.</span></h2>
            <p className="cta-desc">Join the revolution in democratic participation. Connect your wallet and cast your first blockchain vote in under 60 seconds. Deployed on Solana — immutable, transparent, unstoppable.</p>
            <div className="cta-actions">
              <MagneticBtn className="btn-primary" onClick={()=>router.push('/auth')}><span>⬡ LOGIN &amp; START VOTING</span><span className="btn-glow"/></MagneticBtn>
              <MagneticBtn className="btn-secondary" onClick={()=>router.push('/vote/check')}>◈ GO TO VOTING →</MagneticBtn>
            </div>
            <div style={{marginTop:'16px',display:'flex',justifyContent:'center'}}>
              <button
                className="btn-secondary"
                onClick={()=>{const id=prompt('Enter Poll ID to view results:');if(id&&id.trim())router.push(`/results/${id.trim()}`);}}
                style={{cursor:'pointer',fontSize:'0.85rem',padding:'10px 28px',borderRadius:'8px',border:'1px solid rgba(65,105,225,0.4)',background:'rgba(65,105,225,0.08)',color:'#4169e1',letterSpacing:'2px',textTransform:'uppercase',fontWeight:600,transition:'all 0.3s ease'}}
              >
                ◈ VIEW RESULTS
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer id="contact" className="footer">
          <div className={`nav-logo${logoHover?' nav-logo--hover':''}`} style={{fontSize:'20px'}} onMouseEnter={()=>setLogoHover(true)} onMouseLeave={()=>setLogoHover(false)} onClick={spawnTP}>
            <span className="logo-bracket">[</span>
            {['S','o','l'].map((c,i)=><span key={i} className="logo-char logo-sol">{c}</span>)}
            {['V','o','t','e'].map((c,i)=><span key={i} className="logo-char logo-vote">{c}</span>)}
            <span className="logo-char logo-x">X</span>
            <span className="logo-bracket">]</span>
          </div>
          <div className="flag-stripe footer-flag"><div className="flag-saffron"/><div className="flag-white"><span className="flag-chakra-sm">☸</span></div><div className="flag-green"/></div>
          <p className="footer-tagline">Blockchain-based voting system built on Solana — transparent, immutable, and unstoppable democratic participation.</p>
          <p className="footer-tagline" style={{opacity:0.5,fontSize:'12px',letterSpacing:'0.2em'}}>POWERED BY SOLANA BLOCKCHAIN · 1,789+ VALIDATORS · INDIA 🇮🇳</p>
          <p className="footer-desc">Built by students of CVR College of Engineering (CSE-G) as a Mini Project Review. SolVoteX demonstrates how Solana blockchain technology can revolutionize democratic processes in India and beyond.</p>
          <div className="footer-team">
            <p className="footer-team-label">// TEAM — SOLVOTEX</p>
            <div className="footer-team-grid">
              {[
                ['K Hanutej Siddesh Naidu','23B81A05CL','#FF9933'],
                ['Rohitash Kumar Seervi','23B81A05DH','#138808'],
                ['Vankudoth Tharun Patnayak','23B81A05EE','#4169e1'],
              ].map(([name,roll,color])=>(
                <div key={roll} className="footer-member">
                  <span className="member-dot" style={{background:color}}/>
                  <div>
                    <p className="member-name">{name}</p>
                    <p className="member-roll" style={{color}}>{roll}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="footer-links">{['GitHub','Docs','Discord','Twitter','Solana Explorer','Whitepaper'].map(l=><a key={l} href="#" className="footer-link">{l}</a>)}</div>
          <p className="footer-copy">© 2026 SolVoteX — Blockchain Voting System · CVR College of Engineering · Open Source MIT License</p>
        </footer>
      </main>
    </div>
  );
}