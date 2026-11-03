import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';

const directory = new URL('../assets/media/', import.meta.url);
await mkdir(directory, { recursive: true });
const scenes = [
  ['a1','bosque','anaglyph'], ['a2','ciudad-nocturna','anaglyph'],
  ['s1','arrecife','image'], ['s2','galeria','image'],
  ['v1','canon','video'], ['v2','metropolis','video'],
].filter(([id]) => !process.argv[2] || process.argv[2].includes(id));
const browser = await chromium.launch({
  channel: process.env.CHROME_CHANNEL || 'chrome',
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const ffmpeg = execFileSync('python',['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
try {
  const page = await browser.newPage();
  await page.route('http://render.local/**', async route => {
    const name = new URL(route.request().url()).pathname;
    if (name === '/') {
      await route.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/three.module.js"}}</script><script type="module" src="/demo-scenes.mjs"></script>'});
    } else {
      const root = name === '/demo-scenes.mjs' ? './' : './node_modules/three/build/';
      await route.fulfill({contentType:'text/javascript',path:fileURLToPath(new URL(root+name.slice(1),import.meta.url))});
    }
  });
  page.on('pageerror', error=>console.error(error.message));
  await page.goto('http://render.local/');
  await page.waitForFunction(()=>window.setup);
  for (const [id,name,kind] of scenes) {
    await page.evaluate(id=>window.setup(id),id);
    const thumb = await page.evaluate(time=>window.thumbnail(time),kind==='video'?4:0);
    await writeFile(new URL(name+'.webp',directory),Buffer.from(thumb,'base64'));
    const capture = async time => Buffer.from(await page.evaluate(([kind,time])=>window.capture(kind,time),[kind,time]),'base64');
    if (kind !== 'video') {
      await writeFile(new URL(name+'.jpg',directory),await capture(0));
    } else {
      const encoder = spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-threads','2','-f','image2pipe','-framerate','24','-c:v','mjpeg','-i','pipe:0','-c:v','libx264','-threads','4','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',fileURLToPath(new URL(name+'.mp4',directory))],{stdio:['pipe','inherit','inherit']});
      const completed = once(encoder,'exit');
      try {
        for(let i=0;i<360;i++){
          if(!encoder.stdin.write(await capture(i/24))) await once(encoder.stdin,'drain');
          if(i%120===119) console.log(name+' '+(i+1)+'/360');
        }
        encoder.stdin.end();
        const [code] = await completed;
        if(code!==0) throw new Error('FFmpeg exit '+code);
      } finally {
        encoder.stdin.destroy();
        if(encoder.exitCode===null) encoder.kill();
      }
    }
    console.log(name+' listo');
  }
} finally {
  await browser.close();
}
