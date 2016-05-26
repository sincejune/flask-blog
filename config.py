import os
basedir = os.path.abspath(os.path.dirname(__file__))


SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:123456@localhost/blog'

CSRF_ENABLED = True
SECRET_KEY = 'you are not a guy'

# pagination
POSTS_PER_PAGE = 3
