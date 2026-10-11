import subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
names=['diner','motel','redroom','forest'];cmd=['/home/nex-1d0b517c34001000/bin/ffmpeg','-y','-hide_banner','-loglevel','warning','-filter_complex_threads','1']
for n in names:cmd+=['-loop','1','-framerate','24','-i',str(root/'previews'/f'{n}-v2.png')]
filters=[]
for i in range(4):filters.append(f'[{i}:v]scale=1440:900,zoompan=z=1+0.00045*on:x=iw/2-iw/zoom/2:y=ih/2-ih/zoom/2:d=96:s=1200x750:fps=24,trim=duration=4,setpts=PTS-STARTPTS,fps=24,settb=1/24,format=yuv420p[v{i}]')
filters+=['[v0][v1]xfade=transition=fade:duration=0.8:offset=3.2[x1]','[x1][v2]xfade=transition=fade:duration=0.8:offset=6.4[x2]','[x2][v3]xfade=transition=fade:duration=0.8:offset=9.6[out]']
cmd+=['-filter_complex',';'.join(filters),'-map','[out]','-t','13.6','-c:v','libx264','-threads','2','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(root/'previews'/'rebuilt-v2-transitions.mp4')]
subprocess.run(cmd,check=True)
