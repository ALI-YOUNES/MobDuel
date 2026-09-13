$ErrorActionPreference = 'Stop'
$ua = 'Mozilla/5.0'
$out = 'C:\Users\PC\Desktop\MobDuel\public\images\cards'
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Get-Token {
  $t = curl.exe -s -A $ua -X POST -H "x-api-key: 242gag58XGJjOfPPl9nFE8xz92YjMHysKyvVaJ" -H "Content-Type: application/json" -H "Origin: https://ccvaults.com" -H "Referer: https://ccvaults.com/" -d '{}' "https://ccvaults.com/api/token" | ConvertFrom-Json
  return $t.token
}

# card name (exact from catalog) -> "subcategory|filename"
$map = @{
  # COMMON
  "Chicken"="1. Passive|Chicken_Adult.webp"; "Pig"="1. Passive|Pig_Adult.webp";
  "Sheep"="1. Passive|Sheep_Adult.webp"; "Cow"="1. Passive|Cow_Adult.webp";
  "Rabbit"="1. Passive|Rabbit_Brown.webp"; "Cod"="1. Passive|Cod.webp";
  "Salmon"="1. Passive|Salmon.webp"; "Tropical Fish"="1. Passive|Tropical_Fish_Clownfish.webp";
  "Pufferfish"="1. Passive|Pufferfish_Small.webp"; "Squid"="1. Passive|Squid.webp";
  "Glow Squid"="1. Passive|Glow_Squid.webp"; "Bat"="1. Passive|Bat.webp";
  "Parrot"="1. Passive|Parrot_Red.webp"; "Turtle"="1. Passive|Turtle.webp";
  "Frog"="1. Passive|Frog_Temperate.webp"; "Armadillo"="1. Passive|Armadillo.webp";
  "Bee"="2. Neutral|Bee.webp"; "Goat"="2. Neutral|Goat_Adult.webp";
  "Wolf"="2. Neutral|Wolf_Adult_Woods.webp"; "Cat"="1. Passive|Tabby_Cat_Adult.webp";
  "Ocelot"="1. Passive|Ocelot.webp"; "Fox"="2. Neutral|Fox.webp";
  "Dolphin"="2. Neutral|Dolphin.webp"; "Camel"="1. Passive|Camel.webp";
  "Donkey"="1. Passive|Donkey_Adult.webp"; "Mule"="1. Passive|Mule.webp";
  "Horse"="1. Passive|Horse_Adult.webp"; "Sniffer"="1. Passive|Sniffer.webp";
  "Allay"="1. Passive|Allay.webp"; "Villager"="1. Passive|Villager.webp";
  "Zombie"="3. Hostile|Zombie_Adult.webp"; "Skeleton"="3. Hostile|Skeleton.webp";
  "Spider"="2. Neutral|Spider.webp"; "Slime"="3. Hostile|Slime.webp";
  "Silverfish"="3. Hostile|Silverfish.webp"; "Tadpole"="1. Passive|Tadpole.webp";
  # BABY COMMON
  "Baby Chicken"="1. Passive|Chicken_Baby.webp"; "Baby Cow"="1. Passive|Cow_Baby.webp";
  "Baby Pig"="1. Passive|Pig_Baby.webp"; "Baby Sheep"="1. Passive|Sheep_Baby.webp";
  "Baby Wolf"="2. Neutral|Wolf_Baby_Woods.webp"; "Baby Cat"="1. Passive|Tabby_Cat_Baby.webp";
  "Baby Rabbit"="1. Passive|Rabbit_Brown.webp"; "Baby Ocelot"="1. Passive|Ocelot_Baby.webp";
  "Baby Horse"="1. Passive|Horse_Baby.webp"; "Baby Donkey"="1. Passive|Donkey_Baby.webp";
  "Baby Mule"="1. Passive|Mule_Baby.webp"; "Baby Camel"="1. Passive|Camel.webp";
  "Baby Turtle"="1. Passive|Turtle.webp"; "Baby Panda"="2. Neutral|Panda_Baby.webp";
  "Baby Polar Bear"="2. Neutral|Polar_Bear_Baby.webp"; "Baby Fox"="2. Neutral|Fox_Baby.webp";
  "Baby Goat"="2. Neutral|Goat_Baby.webp"; "Baby Bee"="2. Neutral|Bee.webp";
  "Baby Armadillo"="1. Passive|Armadillo.webp"; "Baby Sniffer"="1. Passive|Sniffer_Snifflet.webp";
  "Baby Allay"="1. Passive|Allay.webp"; "Baby Frog"="1. Passive|Frog_Temperate.webp";
  "Baby Axolotl"="1. Passive|Axolotl.webp"; "Baby Dolphin"="2. Neutral|Dolphin.webp";
  "Baby Squid"="1. Passive|Squid.webp"; "Baby Glow Squid"="1. Passive|Glow_Squid.webp";
  "Baby Strider"="2. Neutral|Strider_Idle.webp";
  # ELITE
  "Cave Spider"="2. Neutral|Cave_Spider.webp"; "Creeper"="3. Hostile|Creeper.webp";
  "Drowned"="3. Hostile|Drowned_Adult.webp"; "Husk"="3. Hostile|Husk_Adult.webp";
  "Stray"="3. Hostile|Stray_Idle.webp"; "Phantom"="3. Hostile|Phantom.webp";
  "Magma Cube"="3. Hostile|Magma_Cube.webp"; "Piglin"="2. Neutral|Piglin_Sword.webp";
  "Zombified Piglin"="2. Neutral|Zombified_Piglin_Adult.webp"; "Hoglin"="3. Hostile|Hoglin.webp";
  "Zoglin"="3. Hostile|Zoglin_Adult.webp"; "Pillager"="3. Hostile|Pillager.webp";
  "Vindicator"="3. Hostile|Vindicator.webp"; "Witch"="3. Hostile|Witch.webp";
  "Guardian"="3. Hostile|Guardian_Retracted.webp"; "Snow Golem"="1. Passive|Snow_Golem.webp";
  "Iron Golem"="2. Neutral|Iron_Golem.webp"; "Axolotl"="1. Passive|Axolotl.webp";
  "Panda"="2. Neutral|Panda_Adult.webp"; "Polar Bear"="2. Neutral|Polar_Bear_Adult.webp";
  "Skeleton Horse"="1. Passive|Skeleton_Horse.webp"; "Vex"="3. Hostile|Vex_Normal.webp";
  "Blaze"="3. Hostile|Blaze.webp"; "Wither Skeleton"="3. Hostile|Wither_Skeleton.webp";
  "Evoker"="3. Hostile|Evoker.webp"; "Ravager"="3. Hostile|Ravager.webp";
  "Breeze"="3. Hostile|Breeze.webp"; "Bogged"="3. Hostile|Bogged_Right_Handed.webp";
  "Shulker"="3. Hostile|Shulker.webp"; "Endermite"="3. Hostile|Endermite.webp";
  "Zombie Villager"="3. Hostile|Zombie_Villager_Adult_Plains.webp";
  "Llama"="2. Neutral|Llama_Adult_Creamy.webp"; "Trader Llama"="2. Neutral|Trader_Llama_Adult_Creamy.webp";
  "Strider"="2. Neutral|Strider_Idle.webp";
  # LEGENDARY
  "Enderman"="2. Neutral|Enderman.webp"; "Ghast"="3. Hostile|Ghast.webp";
  "Elder Guardian"="3. Hostile|Elder_Guardian.webp"; "Piglin Brute"="3. Hostile|Piglin_Brute.webp";
  "Warden"="3. Hostile|Warden.webp"; "Charged Creeper"="3. Hostile|Creeper_Charged.webp";
  "Illusioner"="5. Unused|Illusioner.webp"; "Killer Bunny"="1. Passive|Rabbit_Killer_Bunny.webp";
  "Giant"="5. Unused|Giant.webp"; "Mooshroom"="1. Passive|Mooshroom_Red.webp";
  "Zombie Horse"="5. Unused|Zombie_Horse.webp"; "Wither"="4. Boss|Wither.webp";
  # BOSS real
  "Ender Dragon"="4. Boss|Ender_Dragon.webp";
}

# Build fresh token
$tok = Get-Token
$base = "https://ccvaults.com/assets/15.%24%20Mobs"

$cards = Get-Content 'C:\Users\PC\Desktop\MobDuel\backend\prisma\cards-data.json' -Raw | ConvertFrom-Json
$ok = 0; $missing = @()

foreach ($c in $cards) {
  $name = $c.name
  # sanitized output filename (ASCII-safe: replace non [A-Za-z0-9 _-])
  $slug = ($name -replace '[^\w\s-]', '' -replace '\s+', '_')
  $dest = Join-Path $out ($slug + '.webp')

  if ($map.ContainsKey($name)) {
    $parts = $map[$name] -split '\|'
    $sub = [Uri]::EscapeDataString($parts[0])
    $file = [Uri]::EscapeDataString($parts[1])
    $url = "$base/$sub/$file"
    curl.exe -s -A $ua -H "Origin: https://ccvaults.com" -H "Referer: https://ccvaults.com/" -H "Authorization: Bearer $tok" $url -o $dest
    if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 0) {
      $ok++
    } else {
      $missing += ("{0} -> download failed ({1})" -f $name, $parts[1])
    }
  } else {
    $missing += ("{0} -> no mapping (placeholder)" -f $name)
  }
}

Write-Output "Downloaded OK: $ok / $($cards.Count)"
Write-Output '--- Misses ---'
$missing | ForEach-Object { Write-Output $_ }
