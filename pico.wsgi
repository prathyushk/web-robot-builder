import pico.server
import sys, os
sys.stdout = sys.stderr # sys.stdout access restricted by mod_wsgi
path = os.path.dirname(os.path.realpath(__file__)) + "/py"
if path not in sys.path:
    sys.path.insert(0, path)
print path
# Set the WSGI application handler
application = pico.server.wsgi_app