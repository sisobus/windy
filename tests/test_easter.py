from windy.easter import BANNER, SIGNATURE, detect


def test_signature_literal():
    assert SIGNATURE == "sisobus"


def test_detect_positive():
    assert detect("# sisobus was here\n→.@")


def test_detect_negative():
    assert not detect("→.@")


def test_detect_embedded_in_grid():
    # The watermark may live on a row the IP never visits.
    source = "→.@\n\nsisobus lives down here\n"
    assert detect(source)


def test_banner_mentions_author():
    assert "Kim Sangkeun" in BANNER
    assert "sisobus" in BANNER
