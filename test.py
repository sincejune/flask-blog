from app import db, models
import datetime

# u = models.User(nickname='mks', email="test1@test2.com")
#
# #db.create_all()
# db.session.add(u)
# db.session.commit()

#
u = models.User.query.get(1)
p = models.Post(body='My first blog!', timestamp=datetime.datetime.utcnow(), user_id=u.id)

db.session.add(p)
db.session.commit()
