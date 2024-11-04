"""Initial migration

Revision ID: initial_migration
Revises: 
Create Date: 2024-03-04 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'initial_migration'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'profiles',
        sa.Column('profile_url', sa.String(), nullable=False),
        sa.Column('first_name', sa.String(), nullable=True),
        sa.Column('last_name', sa.String(), nullable=True),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('title', sa.Text(), nullable=True),
        sa.Column('connection_since', sa.DateTime(timezone=True), nullable=True),
        sa.Column('profile_image_url', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('project', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('recheck_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('profile_url')
    )

def downgrade():
    op.drop_table('profiles') 