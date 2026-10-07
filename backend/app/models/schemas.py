import hashlib
import json
import unicodedata
from typing import Annotated

import pycountry
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Text = Annotated[str, StringConstraints(min_length=2, max_length=80)]


def clean(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError('Text is required')
    if any(unicodedata.category(c).startswith('C') for c in value):
        raise ValueError('Control characters are not allowed')
    return ' '.join(value.strip().split())


class SearchOptions(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ads: bool = True
    keywords: bool = True
    seasonality: bool = True
    hours: bool = True
    reputation: bool = True


class RelevanceInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    competitor_ranks: list[int] = Field(default_factory=list, max_length=20)
    news_indices: list[int] = Field(default_factory=list, max_length=10)
    reason: str = Field(min_length=3, max_length=500)

    @field_validator('reason', mode='before')
    @classmethod
    def normalize_reason(cls, value):
        return clean(value)


class AnalysisInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    business_category: Text
    city: Text
    country: Text
    keywords: list[str] = Field(min_length=1, max_length=5)
    known_competitors: list[str] = Field(default_factory=list, max_length=5)
    refresh: bool = False
    options: SearchOptions = Field(default_factory=SearchOptions)

    @field_validator('business_category', 'city', 'country', mode='before')
    @classmethod
    def normalize_text(cls, value):
        return clean(value)

    @field_validator('country')
    @classmethod
    def country_exists(cls, value):
        try:
            return pycountry.countries.lookup(value).name
        except LookupError:
            raise ValueError('Enter a recognized country name or two-letter code')

    @field_validator('keywords', 'known_competitors')
    @classmethod
    def normalize_list(cls, values):
        result = [clean(v) for v in values]
        if any(not 2 <= len(v) <= 100 for v in result):
            raise ValueError('Each entry must contain 2–100 characters')
        if len({v.casefold() for v in result}) != len(result):
            raise ValueError('Entries must be unique')
        if any(',' in v for v in result):
            raise ValueError('Use separate entries instead of commas inside an entry')
        return result

    def fingerprint(self, live: bool) -> str:
        data = self.model_dump(exclude={'refresh'})
        data = {k: sorted(vv.casefold() for vv in v) if isinstance(v, list) else v.casefold() if isinstance(v, str) else v for k, v in data.items()}
        data['research_version'] = 2
        data['mode'] = 'live' if live else 'fixture'
        data['methodology'] = '1.0'
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    @property
    def country_code(self):
        return pycountry.countries.lookup(self.country).alpha_2


class JobCreated(BaseModel):
    id: str
    status: str
    cached: bool
    report_url: str


class Report(BaseModel):
    id: str
    status: str
    input: dict
    overall_score: int
    confidence_score: int
    confidence_label: str
    interpretation: str
    component_scores: dict[str, float]
    recommendation: dict
    competitors: list[dict]
    trend_series: list[dict]
    related_queries: list[dict] = Field(default_factory=list)
    seasonality_series: list[dict] = Field(default_factory=list)
    review_matrix: list[dict] = Field(default_factory=list)
    sampled_reviews: list[dict] = Field(default_factory=list)
    reputation: list[dict] = Field(default_factory=list)
    search_usage: dict = Field(default_factory=dict)
    review_topics: list[dict]
    news: list[dict]
    advertising: list[dict]
    evidence: list[dict]
    warnings: list[str]
    methodology_version: str
    methodology: dict
    sections: dict[str, dict]
    data_mode: str
    created_at: str
