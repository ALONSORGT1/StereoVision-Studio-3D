import * as T from 'three';
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(960, 540);
renderer.setClearColor(0);
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
document.body.append(renderer.domElement);
let scene, random, cameraPath, animate, baseline, convergence;
const box = new T.BoxGeometry(1,1,1);
const ball = new T.IcosahedronGeometry(1,1);
const cone = new T.ConeGeometry(1,1,7);
const palette = new Map();
function mat(color, glow = false) {
  const key = color + '/' + glow;
  if (!palette.has(key)) palette.set(key, glow ? new T.MeshBasicMaterial({color}) : new T.MeshStandardMaterial({color,roughness:.86}));
  return palette.get(key);
}
function mesh(geometry,color,x,y,z,w,h,d,glow=false,parent=scene) {
  const object = new T.Mesh(geometry,mat(color,glow));
  object.position.set(x,y,z); object.scale.set(w,h,d);
  parent.add(object); return object;
}
const block = (c,x,y,z,w,h,d,g=false,p=scene) => mesh(box,c,x,y,z,w,h,d,g,p);
const rock = (c,x,y,z,w,h,d,p=scene) => {
  const object = mesh(ball,c,x,y,z,w,h,d,false,p);
  object.rotation.set(random(),random()*6,random()); return object;
};
function branch(color,a,b,width,parent=scene) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b);
  const delta = end.clone().sub(start), mid = start.clone().lerp(end,.5);
  const object = mesh(cone,color,mid.x,mid.y,mid.z,width,delta.length(),width,false,parent);
  object.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
}
function terrain(color, width, length, height, detail) {
  const geo = new T.PlaneGeometry(width,length,detail,detail);
  geo.rotateX(-Math.PI/2); geo.translate(0,0,-length/2+5);
  const pos = geo.attributes.position, colors = [];
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i), z=pos.getZ(i), y=height(x,z);
    pos.setY(i,y);
    const c=new T.Color(color).multiplyScalar(.58+.28*Math.sin(x*2+z*.77)**2+random()*.42);
    colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1})));
}
function tree(x,z,h, dry=false,y=0) {
  const bark=dry?0x593521:0x3e3022;
  branch(bark,[x,y,z],[x+.12,y+h,z],h*.074);
  for(let j=0;j<(dry?4:8);j++) {
    const angle=random()*6.28, length=h*(.13+random()*.14), yy=y+h*(.45+j*.055);
    const end=[x+Math.cos(angle)*length,yy+h*.17,z+Math.sin(angle)*length];
    branch(bark,[x,yy,z],end,h*.029);
    const colors=dry?[0x707247,0x919354,0x555e35]:[0x182f25,0x264b36,0x487648,0x617c3b];
    for(let k=0;k<3;k++) rock(colors[(j+k)%colors.length],end[0]+(random()-.5)*h*.25,end[1]+random()*h*.17,end[2]+(random()-.5)*h*.2,h*.17,h*.13,h*.15);
  }
}
function setup(id) {
  let seed = 1127 + id.charCodeAt(0)*101 + id.charCodeAt(1)*401;
  random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  scene = new T.Scene(); animate=()=>{}; baseline=.19; convergence=12;
  const sky={a1:0x63756b,a2:0x201f3c,s1:0x126985,s2:0x9fa4a9,v1:0xdca682,v2:0x2f234c}[id];
  scene.background=new T.Color(sky);
  scene.fog=new T.FogExp2(sky, id==='s1'?.041:id==='a1'?.035:.013);
  scene.add(new T.HemisphereLight(id==='s1'?0x8feaff:0xffe4cd,id==='v2'?0x7d59cb:0x43546b,2.25));
  const sun=new T.DirectionalLight(id==='v2'?0x68bfff:0xffdbac,2.15);
  sun.position.set(-6,12,-8);scene.add(sun);
  if(id==='a1') {
    cameraPath=()=>[[.65,1.55,3],[.25,2,-16]];
    terrain(0x4c6338,60,100,(x,z)=>.16*Math.sin(x*1.2+z*.4)+.07*Math.cos(z*2),110);
    for(let i=0;i<105;i++){
      const z=-random()*78, sign=i%2?1:-1, x=sign*(1.75+random()*23);
      tree(x,z,3.3+random()*7.5);
    }
    for(let i=0;i<175;i++){
      const z=2-random()*57,x=(i%2?1:-1)*(1.35+random()*12);
      rock(i%3?0x42582e:0x76654d,x,.06,z,.24+random()*.43,.12+random()*.42,.25+random()*.45);
    }
    for(let i=0;i<47;i++) block(0x99865f,Math.sin(i*.23)*.44,.13,2-i*.63,1.15,.035,.58).rotation.y=random()*.35;
    tree(-2.7,1.1,8); tree(3.3,-2,7);
  }
  if(id==='a2') {
    cameraPath=()=>[[3.8,2.2,5.5],[-1.2,2.9,-27]];
    block(0x172e46,0,-.09,-41,15,.15,112);
    for(const side of [-1,1]){
      block(0x716352,side*7.25,.2,-39,3,.42,105);
      for(let i=0;i<25;i++){
        const z=4-i*3.85, x=side*(9.1+random()),h=3.7+random()*4.4;
        const wall=[0x975d51,0x8a745e,0xa68a68,0x665674][i%4];
        block(wall,x,h/2,z,4.6,h,3.7);
        block(0x443745,x,h+.11,z,4.8,.2,3.85);
        const roof=mesh(cone,0x503343,x,h+.72,z,2.9,1.3,2.33);
        roof.rotation.y=.8;
        for(let f=1.2;f<h-.24;f+=1.15)for(const offset of [-1.12,0,1.12]){
          if(random()<.19)continue;
          block(0xffb46a,x-side*2.311,f,z+offset,.035,.62,.41,true);
          block(0x473b44,x-side*2.34,f-.32,z+offset,.12,.09,.56);
        }
        if(i%2===0){
          block(0x514943,side*6.25,1.52,z,.07,2.62,.07);
          mesh(ball,0xffd59b,side*6.25,2.9,z,.13,.18,.13,true);
          for(let j=0;j<10;j++){
            const x=side*(4.6+(random()-.5)*1.75);
            block(0x544458,x,.006,z+random()*2,.2+random()*.64,.012,.07,true);
          }
        }
      }
    }
    const arch = new T.TorusGeometry(2.35,.28,8,28,Math.PI);
    for(const z of [-10,-36,-63]){
      mesh(arch,0x9b7761,0,.24,z,2.65,1.08,1);
      for(let j=-6;j<=6;j++){
        const x=j*.98,y=.62+2.42*Math.sqrt(1-(j/7)**2);
        block(0x82766b,x,y,z,.98,.5,1.3);
        block(0x55483e,x,y+.5,z+.57,.06,.8,.08);
        block(0xbb885e,x,y+.88,z+.57,1.1,.09,.1);
      }
    }
    for(let i=0;i<4;i++){
      const x=(i%2?1:-1)*(1.5+i*.6),z=1-i*15;
      rock(0x745044,x,.19,z,.61,.25,1.93);
      block(0x3b353f,x,.39,z,.72,.29,1.41);
      mesh(ball,0xfbd896,x,.6,z+.49,.1,.1,.1,true);
    }
  }
  if(id==='v2') {
    const neon=[0x62eaff,0xe844b8,0xb797ff,0xffae72];
    block(0x20243d,0,-.15,-45,84,.3,110);
    for(let i=0;i<62;i++) {
      const side=i%2?1:-1, row=Math.floor(i/2)%16, outer=i>31;
      const x=side*((outer?14:6.8)+random()*3),z=3-row*5.5-(outer?2:0);
      const h=5+random()*24,w=3.3+random()*2,d=4.5+random();
      const tone=[0x34344b,0x3e3748,0x27334a,0x433944][i%4];
      block(tone,x,h/2,z,w,h,d);
      block(tone,x,h+.55,z,w*.69,1.1,d*.76);
      for(let k=1;k<h-.2;k+=.9){
        block(neon[i%4],x-side*(w/2+.015),k,z,.018,.055,d*.92,true);
        for(let j=-1;j<=1;j++){
          if(random()<.26)continue;
          block(neon[(i+j+4)%4],x+j*w*.26,k,z+d/2+.012,w*.14,.32,.025,true);
        }
      }
      if(!outer) {
        block(0x515162,side*4.6,.11,z,1.2,.22,5.35);
        block(0x373747,side*4.28,1.4,z,.075,2.6,.075);
        block(neon[i%4],side*4.12,2.7,z,.41,.07,.15,true);
      }
    }
    for(let i=0;i<36;i++) {
      const z=4-i*2.6;
      block(neon[0],0,.008,z,.065,.012,1.0,true);
      for(const x of [-3.9,3.9])block(neon[2],x,.013,z,.045,.02,2.55,true);
    }
    for(let i=0;i<4;i++){
      const z=-13-i*19,h=5+i*1.35;
      block(0x2f384b,0,h,z,16,.55,1.65);
      block(neon[(i+1)%4],0,h+.35,z+.83,15,.075,.04,true);
      block(0x394562,0,h+1.15,z,16,.08,1.65);
    }
    {
      const traffic=[];
      for(let i=0;i<14;i++){
        const group=new T.Group();scene.add(group);
        block(0x5b5b79,0,.15,0,.85,.3,1.6,false,group);
        block(0x8aa4c5,0,.36,-.12,.66,.19,.82,false,group);
        block(neon[i%4],0,.08,.82,.7,.07,.035,true,group);
        block(neon[0],0,.08,-.82,.7,.06,.035,true,group);
        traffic.push(group);
      }
      animate=t=>traffic.forEach((g,i)=>g.position.set((i%2?1:-1)*(1.1+i%3*.63),.28+(i%4)*1.25,-90+((i*9+t*(i%2?5:7))%100)));
      cameraPath=t=>[[.9*Math.sin(t*.36),2.0+.12*t,4-t*3.7],[1.35*Math.sin(t*.36+.5),3.0+.13*t,-12-t*3.7]];
    }
  }
  if(id==='s1') {
    cameraPath=()=>[[.9,2.15,4.2],[-.3,1.65,-17]];
    terrain(0x588991,64,80,(x,z)=>.34*Math.sin(x*.52+z*.31)+.18*Math.sin(x*1.5-z*.52),105);
    for(let i=0;i<165;i++){
      const x=(i%2?1:-1)*(1.2+random()*15),z=1-random()*42;
      const y=.2+random()*.5, size=.17+random()*.67;
      rock([0x496977,0x4e7a7b,0x346675][i%3],x,y*.35,z,size*1.7,size*.66,size);
      if(i%2===0){
        const c=[0xfe9679,0xc870b1,0xf6b85f,0x71c8ac][i%4];
        for(let j=0;j<5;j++){
          const a=j*1.256, ex=x+Math.sin(a)*size*.62,ez=z+Math.cos(a)*size*.62,ey=y+size*(.5+random());
          branch(c,[x,y*.45,z],[ex,ey,ez],size*.19);
          branch(c,[ex,ey-size*.25,ez],[ex+size*.27,ey+size*.23,ez-size*.16],size*.1);
          rock(c,ex,ey,ez,size*.1,size*.13,size*.1);
        }
      }
    }
    const fishBody=new T.SphereGeometry(1,12,8);
    for(let i=0;i<34;i++){
      const group=new T.Group();scene.add(group);
      const c=[0xffcc68,0x59d2e8,0xfc9477,0xa8e6cd][i%4];
      mesh(fishBody,c,0,0,0,.3,.125,.077,false,group);
      const tail=mesh(cone,c,-.31,0,0,.13,.24,.037,false,group);tail.rotation.z=-Math.PI/2;
      mesh(ball,0x152936,.19,.045,.067,.035,.035,.022,false,group);
      mesh(cone,0xf9e4bb,-.02,.1,0,.095,.19,.045,false,group);
      group.position.set((random()-.5)*11,1.15+random()*3.2,1-random()*25);
      group.rotation.y=(random()-.5)*1.45;
      const scale=.42+random()*.95;group.scale.setScalar(scale);
    }
  }
  if(id==='s2') {
    cameraPath=()=>[[1.4,1.55,4.5],[-.8,2,-22]];
    block(0xa19283,0,-.13,-21,15,.24,62);
    block(0x86766c,0,6.9,-21,15,.22,62);
    block(0x796256,7.15,3.35,-21,.35,7,62);
    for(let i=0;i<50;i++)for(let j=-6;j<=6;j++){
      block((i+j)%3?0xaaa397:0x969085,j*1.06,0,4-i*1.08,1.04,.03,1.06);
    }
    for(let i=0;i<10;i++){
      const z=3-i*5.1;
      for(const x of [-6.45,6.45]){
        block(0xa18569,x,3.4,z,.62,6.8,.68);
        block(0xc9ab87,x,.32,z,.91,.64,.93);
        block(0xc9ab87,x,6.44,z,.92,.59,.93);
      }
      block(0x96765a,0,6.53,z,13.5,.46,.85);
      block(0xffdd9f,0,6.25,z,9.8,.065,.11,true);
      block(0xb2cbd0,-7.04,3.2,z-2.43,.08,6.1,4.34,true);
      for(let j=0;j<3;j++)block(0x595550,-6.96,1.3+j*1.59,z-2.43,.09,.045,4.34);
      block(0x5c4435,5.4,.47,z-2.2,1.2,.23,2.7);
      block(0x4c665e,5.4,.63,z-2.2,1.08,.19,2.51);
      if(i%2===0) tree(-5.7,z-2.2,2.2,true,.25);
      if(i%2===0) block(0xc6a384,7,2.9,z-2.5,.12,2.2,2.45);
    }
    block(0x684d3c,0,3.3,-46,14,6.6,.5);
    block(0xffcc89,0,2.6,-45.7,2.55,5.2,.06,true);
  }
  if(id==='v1') {
    convergence=16;
    const curve=z=>2.1*Math.sin(z*.115)+.75*Math.sin(z*.24);
    const floor=(x,z)=>.14*Math.sin(x*.85+z*.31)+.11*Math.cos(z*1.1);
    terrain(0xa97957,84,100,floor,110);
    for(const side of [-1,1]) {
      const positions=[], colors=[], indices=[];
      const rows=151, cols=24;
      for(let i=0;i<rows;i++){
        const z=7-i*.64;
        for(let j=0;j<cols;j++){
          const level=j/(cols-1), h=10+2.8*Math.sin(z*.18+side)+1.7*Math.cos(z*.42);
          const x=curve(z)+side*(4.2+level*2.9+.77*Math.sin(z*.8+level*6)+.5*Math.cos(level*32+z*.09)+random()*.34);
          const y=level*h + .14*Math.sin(z*.65+j*.61);
          positions.push(x,y,z);
          const color=new T.Color([0x9c6045,0xba8056,0x895845,0xd3986a,0xa97557][Math.floor((j+Math.sin(z*.25))*1.7+5)%5]);
          color.multiplyScalar(.74+random()*.25);
          colors.push(color.r,color.g,color.b);
          if(i&&j){
            const k=i*cols+j; indices.push(k,k-1,k-cols,k-1,k-cols-1,k-cols);
          }
        }
      }
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      geo.setIndex(indices);geo.computeVertexNormals();
      scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,side:T.DoubleSide})));
    }
    for(let i=0;i<120;i++){
      const z=3-random()*90,x=curve(z)+(i%2?1:-1)*(2.5+random()*1.25);
      if(i%8===0)tree(x,z,1.4+random()*1.5,true);
      else rock(i%2?0xb37754:0x895e4b,x,.16,z,.24+random()*.65,.16+random()*.73,.21+random()*.79);
    }
    for(let i=0;i<80;i++){
      const z=5-i*1.12,x=curve(z)*.8;
      const water=block(i%3?0x718c84:0x79968a,x,.17,z,1.7,.025,1.14);
      water.rotation.y=Math.atan2(curve(z-1)-curve(z),1)*-.6;
    }
    cameraPath=t=>{
      const z=3-t*4.7;
      return [[curve(z)+.35*Math.sin(t*.55),1.65+.3*Math.sin(t*.48),z],[curve(z-9),2.5,z-9]];
    };
  }
}
const camera=new T.PerspectiveCamera(53,960/540,.1,145);
function draw(eye,t){
  const [from,to]=cameraPath(t);
  camera.position.fromArray(from);camera.lookAt(new T.Vector3(...to));
  const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  camera.position.addScaledVector(right,eye*baseline/2);
  const width=2*camera.near*Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect;
  camera.setViewOffset(960,540,-eye*baseline*.5*camera.near/convergence/width*960,0,960,540);
  renderer.render(scene,camera);
}
const output=document.createElement('canvas');
const ctx=output.getContext('2d',{willReadFrequently:true});
window.setup=setup;
window.capture=(kind,t)=>{
  animate(t);
  output.width=kind==='anaglyph'?960:1920;output.height=540;
  draw(-1,t);ctx.drawImage(renderer.domElement,0,0);
  if(kind==='anaglyph'){
    const left=ctx.getImageData(0,0,960,540);
    draw(1,t);ctx.drawImage(renderer.domElement,0,0);
    const right=ctx.getImageData(0,0,960,540);
    for(let p=0;p<left.data.length;p+=4){
      const l=left.data,r=right.data;
      l[p]=.2126*l[p]+.7152*l[p+1]+.0722*l[p+2];
      l[p+1]=l[p+2]=.2126*r[p]+.7152*r[p+1]+.0722*r[p+2];
    }
    ctx.putImageData(left,0,0);
  } else {draw(1,t);ctx.drawImage(renderer.domElement,960,0);}
  return output.toDataURL('image/jpeg',.9).split(',')[1];
};
window.thumbnail=t=>{
  animate(t);draw(-1,t);
  output.width=320;output.height=180;
  ctx.drawImage(renderer.domElement,0,0,320,180);
  return output.toDataURL('image/webp',.83).split(',')[1];
};
