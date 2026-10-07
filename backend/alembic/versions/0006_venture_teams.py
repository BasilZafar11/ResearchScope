"""VentureAtlas account and team workspaces."""
from alembic import op
from app.models.venture import VentureAccount, VentureSession, VentureTeam
revision='0006'
down_revision='0005'
branch_labels=None
depends_on=None
def upgrade():
    for model in (VentureAccount,VentureSession,VentureTeam):model.__table__.create(op.get_bind(),checkfirst=True)
def downgrade():
    for model in (VentureTeam,VentureSession,VentureAccount):model.__table__.drop(op.get_bind(),checkfirst=True)
