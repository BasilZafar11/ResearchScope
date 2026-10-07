"""Durable research workspace state and bounded revision history."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    identifiers=sa.String(36).with_variant(postgresql.UUID(as_uuid=False), 'postgresql')
    payload=sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql')
    op.create_table('research_states',
                    sa.Column('report_id',identifiers,sa.ForeignKey('novelty_reports.id',ondelete='CASCADE'),primary_key=True),
                    sa.Column('version',sa.Integer(),nullable=False),
                    sa.Column('records',payload,nullable=False),
                    sa.Column('history',payload,nullable=False),
                    sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False))


def downgrade():
    op.drop_table('research_states')
