"""Build original local voice clips and time-aligned phoneme tracks.
Requires system Flite shared libraries + ffmpeg; no network/paid voice services.
Output is committed so neither hosting nor visitors need these tools.
"""
import ctypes as C, json, subprocess, tempfile, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
f=C.CDLL('libflite.so.1',mode=C.RTLD_GLOBAL);f.flite_init()
voice_lib=C.CDLL('libflite_cmu_us_rms.so.1',mode=C.RTLD_GLOBAL)
voice_lib.register_cmu_us_rms.argtypes=[C.c_char_p];voice_lib.register_cmu_us_rms.restype=C.c_void_p
voice=voice_lib.register_cmu_us_rms(None)
for name,args,result in [('flite_synth_text',[C.c_char_p,C.c_void_p],C.c_void_p),('utt_wave',[C.c_void_p],C.c_void_p),('cst_wave_save_riff',[C.c_void_p,C.c_char_p],C.c_int),('utt_relation',[C.c_void_p,C.c_char_p],C.c_void_p),('relation_head',[C.c_void_p],C.c_void_p),('item_next',[C.c_void_p],C.c_void_p),('item_feat_string',[C.c_void_p,C.c_char_p],C.c_char_p),('item_feat_float',[C.c_void_p,C.c_char_p],C.c_float),('delete_utterance',[C.c_void_p],None)]:
 fn=getattr(f,name);fn.argtypes=args;fn.restype=result
SPEED=1.08;PITCH=1.28
visemes={**dict.fromkeys(['p','b','m'],'MBP'),**dict.fromkeys(['aa','ae','ah','aw','ay'],'AA'),**dict.fromkeys(['eh','ey','ih','iy'],'EE'),**dict.fromkeys(['ao','ow','oy'],'OH'),**dict.fromkeys(['uw','uh','w','r'],'OO'),**dict.fromkeys(['f','v','s','z','sh','zh','th','dh','ch','jh'],'grimace')}
entries={}
scripted={}
for p in sorted((ROOT/'src/lipsync/lines').glob('*.json')):
 text=json.loads(p.read_text())['text'];entries[p.stem]=text;scripted[p.stem]=p
entries.update({
 'idle':'Next one? Click Next when you’re ready.',
 'copy':'Want a copy? I’ll show a button. Nothing is copied until you click.',
 'nav':'Finding your way? I’m opening six little shortcuts.',
 'email':'That email doesn’t look complete. Missing an @ there? I’ll point it out.',
 'message':'Your message is empty. I’m focusing the message field; write whatever feels right.',
 'back':'Welcome back! I skipped the long spin. Your curiosity is still welcome.',
 'back-short':'Welcome back! I skipped the long spin.',
 'narrow':'A smaller screen! I’m staying small and out of your way.',
 'work-one':'A playful identity built around a rhythm that never sits still.',
 'work-two':'Original music for curious people and unexpected places.',
 'work-three':'Small animated stories with a human heartbeat.',
 'read':'I’ll read our short story.',
 'work':'Let’s look at the work.',
 **{f'go-{id}':f'I’m taking you to {id}. You can undo the scroll.' for id in ['load','welcome','about','portfolio','contact','bye']}
})
only=sys.argv[2] if len(sys.argv)>2 and sys.argv[1]=='--only' else None
bank=json.loads((ROOT/'src/audio/voices.json').read_text()) if only else {}
if only:entries={id:text for id,text in entries.items() if id==only}
out=ROOT/'public/audio';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='richie-voice-') as tmp:
 for id,text in entries.items():
  speed,pitch={'load':(1.08,1.28),'header':(1.10,1.30),'about':(1.03,1.23),'portfolio':(1.15,1.35),'bye':(.95,1.20)}.get(id,(SPEED,PITCH))
  utterance=f.flite_synth_text(text.replace('’',"'").replace('@','at sign').encode(),voice)
  wav=Path(tmp)/f'{id}.wav';f.cst_wave_save_riff(f.utt_wave(utterance),str(wav).encode())
  cues=[];previous=0;item=f.relation_head(f.utt_relation(utterance,b'Segment'))
  while item:
   phone=f.item_feat_string(item,b'name').decode();end=f.item_feat_float(item,b'end')
   v=visemes.get(phone,'rest')
   if not cues or cues[-1]['v']!=v:cues.append({'t':round(previous/speed,4),'v':v})
   previous=end;item=f.item_next(item)
  dest=out/f'{id}.ogg'
  # Independent pitch/tempo and scene-specific delivery; all phoneme timestamps follow tempo.
  subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),'-af',f'asetrate=16000*{pitch},aresample=48000,atempo={speed/pitch},highpass=f=105,lowpass=f=8500,acompressor=threshold=0.25:ratio=2:attack=5:release=80,alimiter=limit=0.88','-c:a','libvorbis','-q:a','4',str(dest)],check=True)
  subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(dest),'-c:a','libmp3lame','-q:a','3',str(out/f'{id}.mp3')],check=True)
  duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(dest)],text=True))
  cues.append({'t':round(min(duration,previous/speed),4),'v':'rest'})
  line={'text':text,'duration':duration,'cues':cues,'audio':f'/audio/{id}.ogg'}
  bank[text]=line
  if id in scripted:scripted[id].write_text(json.dumps(line,indent=2)+'\n')
  f.delete_utterance(utterance)
  print(f'{id}: {duration:.2f}s, {len(cues)} phoneme cues')
(ROOT/'src/audio/voices.json').write_text(json.dumps(bank,indent=2)+'\n')
