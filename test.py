from app import db, models

u = models.User(nickname='join', email="test@test.com")

#db.create_all()
db.session.add(u)
db.session.commit()
