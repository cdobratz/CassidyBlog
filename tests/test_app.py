import app as blog


def test_health():
    response = blog.app.test_client().get("/health")
    assert response.status_code == 200
    assert response.data == b"ok"


def test_public_pages_render():
    client = blog.app.test_client()
    for path in ("/", "/blog", "/about", "/projects"):
        response = client.get(path)
        assert response.status_code == 200, path


def test_new_post_requires_auth():
    response = blog.app.test_client().get("/blog/new")
    assert response.status_code == 401
