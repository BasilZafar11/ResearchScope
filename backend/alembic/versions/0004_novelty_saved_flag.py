"""Track whether a report should receive the seven-day saved retention."""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('novelty_reports',sa.Column('saved',sa.Boolean(),nullable=False,server_default=sa.true()))

def downgrade():
    op.drop_column('novelty_reports','saved')
