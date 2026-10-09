"""Keep PDF parsing outside the event loop and terminate bounded workers."""
import asyncio
import json
import sys
from pathlib import Path

_slot=asyncio.Semaphore(1)


class PdfBusy(Exception): pass
class PdfUnavailable(Exception): pass


async def extract_pdf(raw):
    if sys.platform!='linux':raise PdfUnavailable()
    if _slot.locked():raise PdfBusy()
    async with _slot:
        process=await asyncio.create_subprocess_exec(sys.executable,'-I',str(Path(__file__).with_name('pdf_worker.py')),
            stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL,env={})
        try:
            output,_=await asyncio.wait_for(process.communicate(raw),timeout=8)
            if process.returncode!=0 or len(output)>1_000_000:raise ValueError('PDF extraction failed')
            return json.loads(output)
        finally:
            if process.returncode is None:
                process.kill()
                await process.wait()
