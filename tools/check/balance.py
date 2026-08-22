import io,sys

def strip(src):
    out=[];i=0;n=len(src)
    while i<n:
        c=src[i]
        if c=='/' and i+1<n and src[i+1]=='/':
            while i<n and src[i]!='\n': i+=1
            continue
        if c=='/' and i+1<n and src[i+1]=='*':
            i+=2
            while i+1<n and not(src[i]=='*' and src[i+1]=='/'): i+=1
            i+=2; continue
        if c=='@' and i+1<n and src[i+1]=='"':
            i+=2
            while i<n:
                if src[i]=='"':
                    if i+1<n and src[i+1]=='"': i+=2; continue
                    i+=1; break
                i+=1
            continue
        if c=='"':
            i+=1
            while i<n:
                if src[i]=='\\': i+=2; continue
                if src[i]=='"': i+=1; break
                # interpolation holes keep their braces so they still balance
                out.append(src[i] if src[i] in '{}()' else ' ')
                i+=1
            continue
        if c=="'":
            i+=1
            while i<n:
                if src[i]=='\\': i+=2; continue
                if src[i]=="'": i+=1; break
                i+=1
            continue
        out.append(c); i+=1
    return ''.join(out)

bad=False
for p in sys.argv[1:]:
    s=strip(io.open(p,encoding='utf-8-sig').read())
    b=s.count('{')-s.count('}'); r=s.count('(')-s.count(')')
    st='OK ' if b==0 and r==0 else 'BAD'
    if b or r: bad=True
    print(f'{st} braces={b:+d} parens={r:+d}  {p}')
sys.exit(1 if bad else 0)
