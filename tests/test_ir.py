from windy.ir import IP, SPACE, Grid


def test_grid_missing_cell_defaults_to_space():
    g = Grid()
    assert g.get(10, -3) == SPACE


def test_grid_put_and_get_roundtrip():
    g = Grid()
    g.put(2, 5, ord("@"))
    assert g.get(2, 5) == ord("@")


def test_grid_put_space_is_sparse():
    g = Grid({(0, 0): ord("@")})
    g.put(0, 0, SPACE)
    assert (0, 0) not in g.cells
    assert g.get(0, 0) == SPACE


def test_ip_advances_by_direction():
    ip = IP()
    ip.advance()
    assert (ip.x, ip.y) == (1, 0)
    ip.set_dir(0, 1)
    ip.advance()
    assert (ip.x, ip.y) == (1, 1)


def test_ip_negative_direction():
    ip = IP(x=5, y=5, dx=-1, dy=-1)
    ip.advance()
    assert (ip.x, ip.y) == (4, 4)
