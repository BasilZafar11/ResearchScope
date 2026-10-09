"""Validate the record formats shared by browser imports and collaboration."""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA=json.loads(Path(__file__).with_name('research_record_schema.json').read_text())

def absolute_http_url(value):
    if value!=value.strip() or re.search(r'[\x00-\x1f\x7f-\x9f\\]',value) or not re.match(r'^https?://',value,re.I):
        return False
    try:
        parsed=urlsplit(value)
        # Accessing port also rejects malformed or out-of-range port numbers.
        parsed.port
        return parsed.scheme.lower() in {'http','https'} and bool(parsed.hostname) and not re.search(r'\s',parsed.netloc) and parsed.username is None and parsed.password is None
    except ValueError:
        return False

def validate_records(records):
    def check(value,rule,path,depth=0):
        if depth>32:raise ValueError(f'{path}: records are nested too deeply.')
        if '$ref' in rule:return check(value,SCHEMA['$defs'][rule['$ref'].split('/')[-1]],path,depth)
        if 'anyOf' in rule:
            for alternative in rule['anyOf']:
                try:check(value,alternative,path,depth);return
                except ValueError:pass
            raise ValueError(f'{path}: unsupported record structure.')
        kind=rule.get('type')
        valid={'object':isinstance(value,dict),'array':isinstance(value,list),'string':isinstance(value,str),
               'number':isinstance(value,(int,float)) and not isinstance(value,bool) and abs(value)<=1.7976931348623157e308,
               'boolean':isinstance(value,bool),'null':value is None}
        if kind and not valid[kind]:raise ValueError(f'{path}: expected {kind}.')
        if 'enum' in rule and value not in rule['enum']:raise ValueError(f'{path}: unsupported value.')
        if isinstance(value,str) and len(value)>rule.get('maxLength',1_500_000):raise ValueError(f'{path}: text is too long.')
        if isinstance(value,list):
            if len(value)>rule.get('maxItems',1000):raise ValueError(f'{path}: too many entries.')
            for index,item in enumerate(value):check(item,rule.get('items',{}),f'{path}[{index}]',depth+1)
        if isinstance(value,dict):
            for key in rule.get('required',[]):
                if key not in value:raise ValueError(f'{path}.{key}: required field is missing.')
            for key,item in value.items():
                if key in {'__proto__','prototype','constructor'}:raise ValueError(f'{path}: unsafe object key.')
                if re.search(r'url$',key,re.I) and isinstance(item,str) and item and not absolute_http_url(item):
                    raise ValueError(f'{path}.{key}: source URLs must be absolute HTTP or HTTPS links without credentials or control characters.')
                child=rule.get('properties',{}).get(key)
                if child is None:
                    child=next((shape for pattern,shape in rule.get('patternProperties',{}).items() if re.search(pattern,key)),None)
                if child is None:
                    child=rule.get('additionalProperties',{})
                    if child is False:raise ValueError(f'{path}.{key}: unsupported record group.')
                    if child is True:child={}
                check(item,child,f'{path}.{key}',depth+1)
    check(records,SCHEMA,'records')
