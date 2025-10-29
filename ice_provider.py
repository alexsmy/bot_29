import os
import json
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

CONFIG_FILE = "ice_servers.json"

def _get_twilio_servers():
    """Fetches TURN server credentials from Twilio if configured."""
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")

    if not account_sid or not auth_token:
        print("Twilio credentials not found in environment variables.")
        return []

    try:
        client = Client(account_sid, auth_token)
        # ttl (time-to-live) 86400 seconds = 24 hours.
        token = client.tokens.create(ttl=86400)
        print("Successfully fetched ICE servers from Twilio.")
        # Augment the response with provider metadata
        augmented_servers = []
        for server in token.ice_servers:
            server['region'] = 'global'
            server['provider'] = 'twilio.com'
            augmented_servers.append(server)
        return augmented_servers
    except TwilioException as e:
        print(f"Failed to get ICE servers from Twilio: {e}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred while contacting Twilio: {e}")
        return []

def get_ice_servers():
    """
    Loads a list of STUN/TURN servers from the JSON configuration file
    and dynamically fetches credentials for TURN providers.
    """
    ice_servers_list = []

    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"CRITICAL: Could not load or parse '{CONFIG_FILE}': {e}")
        print("Falling back to a single public STUN server.")
        return [{"urls": "stun:stun.l.google.com:19302", "region": "global", "source": "google.com"}]

    # 1. Add all public STUN servers from the config
    stun_servers = config.get("stun_servers", [])
    if stun_servers:
        # We pass the full object to preserve metadata like region and source
        ice_servers_list.extend(stun_servers)
    print(f"Loaded {len(stun_servers)} public STUN servers.")

    # 2. Sequentially try to get TURN servers from configured providers
    turn_providers = config.get("turn_providers", [])
    for provider in turn_providers:
        provider_name = provider.get("provider")
        
        if provider_name == "twilio":
            twilio_servers = _get_twilio_servers()
            if twilio_servers:
                ice_servers_list.extend(twilio_servers)
        
        elif provider_name == "xirsys":
            # Placeholder for Xirsys integration
            # You would need to implement the logic to check env variables
            # and make an API call to the Xirsys service.
            if os.environ.get("XIRSYS_IDENT") and os.environ.get("XIRSYS_SECRET"):
                print("Xirsys provider is defined but not implemented yet.")
                # Example: ice_servers_list.extend(get_xirsys_servers())
            pass
            
        elif provider_name == "self-hosted (coturn)":
            # Placeholder for self-hosted Coturn integration
            # This would typically involve formatting static credentials
            # from environment variables, not making an API call.
            if os.environ.get("COTURN_HOST") and os.environ.get("COTURN_USER") and os.environ.get("COTURN_SECRET"):
                 print("Coturn provider is defined but not implemented yet.")
                 # Example:
                 # coturn_server = {
                 #    "urls": f"turn:{os.environ['COTURN_HOST']}",
                 #    "username": os.environ['COTURN_USER'],
                 #    "credential": os.environ['COTURN_SECRET']
                 # }
                 # ice_servers_list.append(coturn_server)
            pass

    if not ice_servers_list:
        print("WARNING: No ICE servers could be configured. Using fallback.")
        return [{"urls": "stun:stun.l.google.com:19302", "region": "global", "source": "google.com"}]

    print(f"Total configured ICE servers: {len(ice_servers_list)}")
    return ice_servers_list