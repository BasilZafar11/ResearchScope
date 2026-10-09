"""One Linux PDF worker. No credentials, network requests, or file persistence."""
import sys


def main():
    # Fail closed on platforms without enforceable process resource limits.
    import resource
    resource.setrlimit(resource.RLIMIT_CPU,(3,3))
    resource.setrlimit(resource.RLIMIT_AS,(192*1024*1024,192*1024*1024))
    resource.setrlimit(resource.RLIMIT_FSIZE,(0,0))
    resource.setrlimit(resource.RLIMIT_NOFILE,(32,32))
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    resource.setrlimit(resource.RLIMIT_NPROC,(0,0))
    import json
    from io import BytesIO
    from pypdf import PdfReader
    raw=sys.stdin.buffer.read(5_000_001)
    if len(raw)>5_000_000 or not raw.startswith(b'%PDF-'):raise ValueError('Invalid PDF')
    reader=PdfReader(BytesIO(raw),strict=False)
    if reader.is_encrypted:raise ValueError('Encrypted PDF')
    passages=[]
    for index,page in enumerate(reader.pages):
        if index>=30:break
        content=' '.join((page.extract_text() or '')[:20000].split())
        for sentence in content.split('. '):
            if len(sentence)>=45:passages.append({'page':index+1,'text':sentence[:700]})
            if len(passages)>=1000:break
        if len(passages)>=1000:break
    sys.stdout.write(json.dumps({'page_count':len(reader.pages),'passages':passages}))


if __name__=='__main__':
    main()
