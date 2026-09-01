#!/bin/bash
# Watchdog ÓRBITA: relanza el pipeline hasta que termine (resumible por clip).
cd /home/z/my-project/scripts/orbita3d || exit 1
for i in $(seq 1 40); do
  if grep -q PIPELINE_OK pipeline.log 2>/dev/null; then
    echo "WATCHDOG: pipeline completo (intento $i)" >> pipeline.log
    exit 0
  fi
  echo "WATCHDOG: intento $i $(date +%H:%M:%S)" >> pipeline.log
  python3 run_pipeline.py "ORBITA_3D_LaFloresta.mp4" >> pipeline.log 2>&1
  sleep 2
done
echo "WATCHDOG: agotado" >> pipeline.log
