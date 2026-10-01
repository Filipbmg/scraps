from app.features.collection.schemas import SourceConfig

RUSSIA_TERMS = ["russia", "russian", "rusland", "russisk", "putin", "kremlin", "kreml", "moscow", "moskva", "kaliningrad"]
DENMARK_TERMS = ["denmark", "danmark", "danish", "dansk", "copenhagen", "københavn", "bornholm", "greenland", "grønland", "faroe", "færø"]

NEWS_PRESETS = [
    ("dr-world", SourceConfig(provider="rss", name="DR · Udland", target="https://www.dr.dk/nyheder/service/feeds/udland", keywords=RUSSIA_TERMS)),
    ("dr-denmark", SourceConfig(provider="rss", name="DR · Indland", target="https://www.dr.dk/nyheder/service/feeds/indland", keywords=RUSSIA_TERMS)),
    ("bbc-europe", SourceConfig(provider="rss", name="BBC · Europe", target="https://feeds.bbci.co.uk/news/world/europe/rss.xml", keywords=RUSSIA_TERMS)),
    ("guardian-russia", SourceConfig(provider="rss", name="The Guardian · Russia", target="https://www.theguardian.com/world/russia/rss")),
]
