from datetime import date, datetime, timezone, timedelta
from typing import Literal
import pycountry
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.schemas import clean

Tool = Literal['directions', 'forums', 'autocomplete', 'events', 'jobs', 'shopping', 'hotels', 'flights', 'images', 'scholar']
ENGINES = {name: 'google_' + name for name in ('forums', 'autocomplete', 'events', 'jobs', 'shopping', 'hotels', 'flights', 'images', 'scholar')}
ENGINES['directions'] = 'google_maps_directions'


class ResearchInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    tool: Tool
    query: str = Field(default='', max_length=160)
    origin: str = Field(default='', max_length=160)
    competitor_ranks: list[int] = Field(default_factory=list, max_length=3)
    travel_mode: Literal['walking', 'driving', 'transit'] = 'walking'
    check_in: date | None = None
    check_out: date | None = None
    departure_date: date | None = None
    departure_airport: str = Field(default='', max_length=3)
    arrival_airport: str = Field(default='', max_length=3)
    currency: Literal['INR', 'USD', 'EUR', 'GBP'] = 'INR'
    adults: int = Field(default=1, ge=1, le=6)
    refresh: bool = False

    @field_validator('query', 'origin', mode='before')
    @classmethod
    def normalize_text(cls, value):
        return clean(value)

    @field_validator('departure_airport', 'arrival_airport', mode='before')
    @classmethod
    def airport(cls, value):
        return clean(value).upper()

    @model_validator(mode='after')
    def valid_inputs(self):
        today = datetime.now(timezone.utc).date()
        if self.tool == 'directions':
            if len(self.origin) < 3 or not self.competitor_ranks or len(set(self.competitor_ranks)) != len(self.competitor_ranks):
                raise ValueError('Enter a public starting landmark and select 1–3 distinct competitors.')
        elif self.tool != 'flights' and len(self.query) < 3:
            raise ValueError('Enter a search phrase of at least three characters.')
        if self.tool == 'hotels':
            if not self.check_in or not self.check_out or not today <= self.check_in < self.check_out <= today + timedelta(days=330):
                raise ValueError('Choose future hotel dates within 330 days, with checkout after check-in.')
            if (self.check_out-self.check_in).days > 28:
                raise ValueError('Hotel stays are limited to 28 nights.')
        if self.tool == 'flights':
            airports = [self.departure_airport, self.arrival_airport]
            if any(len(a) != 3 or not a.isascii() or not a.isalpha() for a in airports) or airports[0] == airports[1]:
                raise ValueError('Enter two different three-letter airport codes.')
            if not self.departure_date or not today <= self.departure_date <= today + timedelta(days=330):
                raise ValueError('Choose a departure date within the next 330 days.')
        return self

    def canonical(self):
        fields = {'tool'}
        if self.tool == 'directions':
            fields |= {'origin', 'competitor_ranks', 'travel_mode'}
        elif self.tool == 'flights':
            fields |= {'departure_airport', 'arrival_airport', 'departure_date', 'adults', 'currency'}
        else:
            fields.add('query')
            if self.tool == 'hotels':
                fields |= {'check_in', 'check_out', 'adults', 'currency'}
        result = self.model_dump(mode='json', include=fields)
        if 'competitor_ranks' in result:
            result['competitor_ranks'] = sorted(result['competitor_ranks'])
        return result


def plan_requests(data: ResearchInput, report):
    """Allowlisted provider parameters. Every module is bounded to three calls."""
    country = pycountry.countries.lookup(report['input']['country']).alpha_2.lower()
    locale = {'hl': 'en', 'gl': country}
    location = report['input']['city'] + ', ' + report['input']['country']
    if data.tool == 'directions':
        selected = [p for p in report['competitors'] if p['rank'] in data.competitor_ranks]
        if len(selected) != len(data.competitor_ranks):
            raise ValueError('Select competitors belonging to this report.')
        requests = []
        for p in selected:
            if p.get('latitude') is None or p.get('longitude') is None:
                raise ValueError('Selected competitors need map coordinates.')
            params = {**locale, 'start_addr':data.origin, 'end_coords':f"{p['latitude']},{p['longitude']}",
                      'travel_mode': {'walking':2, 'driving':0, 'transit':3}[data.travel_mode], 'distance_unit':0}
            requests.append({'label':p['name'], 'params':params, 'context':{'rank':p['rank'], 'mode':data.travel_mode, 'origin':data.origin}})
        return requests
    if data.tool == 'hotels':
        return [{'label':(data.check_in + timedelta(days=offset)).isoformat(), 'context':{'check_in':(data.check_in + timedelta(days=offset)).isoformat(), 'currency':data.currency},
                 'params':{**locale,'q':data.query,'check_in_date':(data.check_in + timedelta(days=offset)).isoformat(),
                           'check_out_date':(data.check_out + timedelta(days=offset)).isoformat(),'adults':data.adults,'currency':data.currency}} for offset in (0,7,14)]
    if data.tool == 'flights':
        return [{'label':f'{data.departure_airport} → {data.arrival_airport}', 'context':{'currency':data.currency,'date':data.departure_date.isoformat()},
                 'params':{**locale,'departure_id':data.departure_airport,'arrival_id':data.arrival_airport,'outbound_date':data.departure_date.isoformat(),
                           'type':2,'adults':data.adults,'currency':data.currency}}]
    queries = [data.query, data.query + ' for', data.query + ' near'] if data.tool == 'autocomplete' else [data.query]
    params = locale if data.tool != 'scholar' else {'hl':'en'}
    if data.tool in ('forums','events','jobs','shopping','images'):
        params = {**params, 'location':location}
    if data.tool == 'autocomplete':
        params = {**params, 'client':'chrome'}
    if data.tool == 'scholar':
        params = {**params, 'num':10}
    return [{'label':q, 'params':{**params,'q':q},'context':{'query':q}} for q in queries]
