from datetime import datetime
from sqlalchemy import String, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.database import Base, id_type, json_type, now, uid
class VentureAccount(Base):
    __tablename__='venture_accounts'
    id: Mapped[str]=mapped_column(id_type,primary_key=True,default=uid)
    username: Mapped[str]=mapped_column(String(40),unique=True)
    password_hash: Mapped[str]=mapped_column(String(200))
class VentureSession(Base):
    __tablename__='venture_sessions'
    token_hash: Mapped[str]=mapped_column(String(64),primary_key=True)
    account_id: Mapped[str]=mapped_column(id_type,index=True)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True))
class VentureTeam(Base):
    __tablename__='venture_teams'
    id: Mapped[str]=mapped_column(id_type,primary_key=True,default=uid)
    report_id: Mapped[str]=mapped_column(id_type,index=True)
    name: Mapped[str]=mapped_column(String(100))
    owner_id: Mapped[str]=mapped_column(id_type)
    members: Mapped[dict]=mapped_column(json_type,default=dict)
    payload: Mapped[dict]=mapped_column(json_type,default=lambda:{'tasks':[],'comments':[],'decisions':[]})
    version: Mapped[int]=mapped_column(Integer,default=1)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
