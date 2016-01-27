import pico.server
import sys
sys.stdout = sys.stderr # sys.stdout access restricted by mod_wsgi
path = '/var/www/html/' # the modules you want to be usable by Pico
if path not in sys.path:
    sys.path.insert(0, path)

# Set the WSGI application handler
application = pico.server.wsgi_app