PLEX="http://PLEX-IP:32400" # Plex IP
TOKEN="hier Token" # Plextoken
SECTION="5" # Section -> find with "curl -H "X-Plex-Token: PLEXTOKEN"      http://IP-PLEX:32400/library/sections

IDS=$(curl -s -H "X-Plex-Token: $TOKEN" "$PLEX/library/sections/$SECTION/collections" \
  | grep -oP 'ratingKey="\K[0-9]+')

for ID in $IDS; do
  echo "Lösche Sammlung $ID ..."
  curl -s -X DELETE -H "X-Plex-Token: $TOKEN" "$PLEX/library/collections/$ID"
done

echo "Alle Sammlungen in Section $SECTION gelöscht."
