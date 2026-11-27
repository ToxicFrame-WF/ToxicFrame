// What counts as a resource, from the wiki (wiki.warframe.com/w/Module:Resources/data, read 2026-11-23).
// shortcut: a hand-refreshed copy; regenerate with scripts/wiki_resources_gen.py when new resources come out.
// game unique name -> [wiki type, wiki image file]
export const WIKI_RESOURCES: Record<string, [string, string]> = {
  '/Lotus/Types/Game/CatbrowPet/CatbrowGeneticSignature': ['Resource', 'KavatGeneticCode.png'],
  '/Lotus/Types/Game/FishBait/Infested/InfestedFishBaitA': ['Resource', 'FassResidue.png'],
  '/Lotus/Types/Game/FishBait/Infested/OrokinFishBaitA': ['Resource', 'VomeResidue.png'],
  '/Lotus/Types/Game/KubrowPet/EggHatcher': ['Resource', 'IncubatorPowerCore.png'],
  '/Lotus/Types/Game/Nemesis/KuvaLich/CapturedCorpusLichToken': [
    'Resource',
    'SisterOfParvosToken.png'
  ],
  '/Lotus/Types/Game/Nemesis/KuvaLich/CapturedGrineerLichToken': ['Resource', 'LichToken.png'],
  '/Lotus/Types/Game/SpectreArmies/BronzeSpectreArmy': ['Resource', 'VaporSpecterRegiment.png'],
  '/Lotus/Types/Game/SpectreArmies/GoldSpectreArmy': ['Resource', 'ForceSpecterRegiment.png'],
  '/Lotus/Types/Game/SpectreArmies/PlatinumSpectreArmy': ['Resource', 'CosmicSpecterRegiment.png'],
  '/Lotus/Types/Game/SpectreArmies/SilverSpectreArmy': ['Resource', 'PhaseSpecterRegiment.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/1999ResourceCommonA': ['Resource', 'EfervonSample.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/1999ResourceCommonB': [
    'Resource',
    'HollvanianPitchweaveFragment.png'
  ],
  '/Lotus/Types/Gameplay/1999Wf/Resources/1999ResourceDefense': [
    'Resource',
    'BeatingHeartstrings.png'
  ],
  '/Lotus/Types/Gameplay/1999Wf/Resources/1999ResourceRareA': [
    'Resource',
    'TechrotMotherboard.png'
  ],
  '/Lotus/Types/Gameplay/1999Wf/Resources/1999ResourceUncommonA': ['Resource', 'TechrotChitin.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/1999ResourceUncommonB': [
    'Resource',
    'ExperimentalArc-Relay.png'
  ],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagAmir': ['Resource', 'TheCountessaComic.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagAoi': ['Resource', 'On-lyneCD.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagArthur': [
    'Resource',
    "Chuggin'AlongSixpack.png"
  ],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagEleanor': ['Resource', 'MoodCrystal.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagLettie': ['Resource', 'CheddarCrownsCereal.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagQuincy': ['Resource', '35mmFilm.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagRare': ['Resource', 'BigBytesPizza.png'],
  '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagUncommon': ['Resource', 'ArgonBurgerMeal.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriDragonDropItem': ['Resource', 'PathosClamp.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriEnemyDropItem': ['Resource', 'Lamentus.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriFractalItem': ['Resource', 'RuneMarrow.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriKullervoDropItem': [
    'Resource',
    "Kullervo'sBane.png"
  ],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriMushroomItem': ['Resource', 'TasomaExtract.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPlantItemA': ['Resource', 'Kovnik.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPlantItemB': ['Resource', 'Eevani.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPlantItemC': ['Resource', 'ConnlaSprout.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPlantItemD': ['Resource', 'YaoShrub.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPlantItemE': ['Resource', 'Silphsela.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPlantItemF': ['Resource', 'Dracroot.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPlantItemG': ['Resource', 'Ueymag.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriProcessedItem': ['Resource', 'SaggenPearl.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriPuzzleItem': ['Resource', 'EnigmaGyrum.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/DuviriRockItem': ['Resource', 'Aggristone.png'],
  '/Lotus/Types/Gameplay/Duviri/Resource/Fish/GenericDuviriFishPartAItem': [
    'Fish Part',
    'NacreousPebble.png'
  ],
  '/Lotus/Types/Gameplay/Duviri/Resource/Fish/GenericDuviriFishPartBItem': [
    'Fish Part',
    'ArietteScale.png'
  ],
  '/Lotus/Types/Gameplay/Duviri/Resource/Fish/GenericDuviriFishPartCItem': [
    'Fish Part',
    'MawFang.png'
  ],
  '/Lotus/Types/Gameplay/DuviriMITW/Resources/DuviriMurmurItemA': ['Resource', 'TemporalDust.png'],
  '/Lotus/Types/Gameplay/DuviriMITW/Resources/DuviriMurmurItemB': ['Resource', 'ScuttlerHusk.png'],
  '/Lotus/Types/Gameplay/DuviriMITW/Resources/DuviriMurmurItemEvent': [
    'Resource',
    'DominusAureus.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/BirdOfPreyPartItem': ['Resource', 'CondrocWing.png'],
  '/Lotus/Types/Gameplay/Eidolon/Resources/CetusWispItem': ['Resource', 'CetusWisp.png'],
  '/Lotus/Types/Gameplay/Eidolon/Resources/ForestRodentPartItem': [
    'Resource',
    'KuakaSpinalClaw.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/QuillsDogTag': ['Resource', 'IntactSentientCore.png'],
  '/Lotus/Types/Gameplay/Eidolon/Resources/QuillsRareDogTag': [
    'Resource',
    'FlawlessSentientCore.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/QuillsUncommonDogTag': [
    'Resource',
    'ExceptionalSentientCore.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/SentientSecretItem': ['Resource', 'RivenTransmuter.png'],
  '/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/LephantisShardItem': [
    'Event',
    'HemocyteCystolith.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardBrilliantItem': [
    'Resource',
    'BrilliantEidolonShard.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardBrilliantTierTwoItem': [
    'Resource',
    'RadiantEidolonShard.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardCommonItem': [
    'Resource',
    'EidolonShard.png'
  ],
  '/Lotus/Types/Gameplay/Eidolon/Resources/SentientShards/SentientShardSynthesizedItem': [
    'Resource',
    'SyntheticEidolonShard.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiEventCurseItemA': [
    'Event',
    'CurseofKnowing.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiEventCurseItemB': [
    'Event',
    'CurseofHearing.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiEventCurseItemC': [
    'Event',
    'CurseofSeeing.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiEventOctopedeItem': [
    'Event',
    'GrotesqueSplinter.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiLabDogTagCommon': [
    'Resource',
    'ShrillVoca.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiLabDogTagRare': ['Resource', 'EchoVoca.png'],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiLabDogTagUncommon': [
    'Resource',
    'BellowVoca.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/EntratiLabMiscItemA': [
    'Resource',
    'EntratiObols.png'
  ],
  '/Lotus/Types/Gameplay/EntratiLab/Resources/VesselCapillaries': [
    'Resource',
    'VesselCapillaries.png'
  ],
  '/Lotus/Types/Gameplay/Events/RoadToTauEvent/RoadToTauEventResource': [
    'Resource',
    'Moonflesh.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/DamagedMechPartChassisItem': [
    'Resource',
    'DamagedNecramechCasing.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/DamagedMechPartEngineItem': [
    'Resource',
    'DamagedNecramechEngine.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/DamagedMechPartSystemsItem': [
    'Resource',
    'DamagedNecramechPod.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/DamagedMechPartWeaponPodItem': [
    'Resource',
    'DamagedNecramechWeaponPod.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/DamagedMechWeaponBarrelItem': [
    'Resource',
    'DamagedNecramechWeaponBarrel.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/DamagedMechWeaponReceiverItem': [
    'Resource',
    'DamagedNecramechWeaponReceiver.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/DamagedMechWeaponStockItem': [
    'Resource',
    'DamagedNecramechWeaponStock.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/NecromechPartChassisItem': [
    'Resource',
    'VoidrigCasing.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/NecromechPartEngineItem': [
    'Resource',
    'VoidrigEngine.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/NecromechPartSystemsItem': [
    'Resource',
    'VoidrigCapsule.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/NecromechPartWeaponPodItem': [
    'Resource',
    'VoidrigWeaponPod.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanomechPartChassisItem': [
    'Resource',
    'BonewidowCasing.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanomechPartEngineItem': [
    'Resource',
    'BonewidowEngine.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanomechPartSystemsItem': [
    'Resource',
    'BonewidowCapsule.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanomechPartWeaponPodItem': [
    'Resource',
    'BonewidowWeaponPod.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanotechArchGunBarrelItem': [
    'Resource',
    'CortegeBarrel.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanotechArchGunReceiverItem': [
    'Resource',
    'CortegeReceiver.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanotechArchGunStockItem': [
    'Resource',
    'CortegeStock.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanotechGrenadeLauncherBarrelItem': [
    'Resource',
    'MorghaBarrel.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanotechGrenadeLauncherReceiverItem':
    ['Resource', 'MorghaReceiver.png'],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Mechs/ThanotechGrenadeLauncherStockItem': [
    'Resource',
    'MorghaStock.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Necraloids/NecraloidStandingCommonItem': [
    'Resource',
    'OrokinOrientationMatrix.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Necraloids/NecraloidStandingRareItem': [
    'Resource',
    'OrokinAnimusMatrix.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/Necraloids/NecraloidStandingUncommonItem': [
    'Resource',
    'OrokinBallisticsMatrix.png'
  ],
  '/Lotus/Types/Gameplay/InfestedMicroplanet/Resources/OrbStoneItem': [
    'Resource',
    'LucentTeroglobe.png'
  ],
  '/Lotus/Types/Gameplay/JadeShadows/Resources/AscensionEventResourceItem': [
    'Event',
    'VolatileMotes.png'
  ],
  '/Lotus/Types/Gameplay/JadeShadows/Resources/AscensionResourceItem': [
    'Resource',
    'VestigialMotes.png'
  ],
  '/Lotus/Types/Gameplay/Shadowgrapher/Resources/ShadowgrapherEventResource': [
    'Event',
    'NightmareTatters.png'
  ],
  '/Lotus/Types/Gameplay/Shadowgrapher/Resources/ShadowgrapherResource': [
    'Resource',
    'Atramentum.png'
  ],
  '/Lotus/Types/Gameplay/Tau/Resources/CoHResourceCommonItem': ['Resource', 'Ignia.png'],
  '/Lotus/Types/Gameplay/Tau/Resources/CoHResourceRareItem': ['Resource', 'Maphica.png'],
  '/Lotus/Types/Gameplay/Tau/Resources/TwelveBossResourceDactolystItem': [
    'Resource',
    'RenHypercore.png'
  ],
  '/Lotus/Types/Gameplay/Tau/Resources/TwelveBossResourceHunhullusItem': [
    'Resource',
    'LyroicBridge.png'
  ],
  '/Lotus/Types/Gameplay/Tau/Resources/TwelveBossResourcePrimesItem': [
    'Resource',
    'AscarisPrime.png'
  ],
  '/Lotus/Types/Gameplay/Tau/Resources/TwelveResourceCommonItem': ['Resource', 'Agnovidisc.png'],
  '/Lotus/Types/Gameplay/Tau/Resources/TwelveResourceCurrencyItem': [
    'Event',
    'MarksOfValiance.png'
  ],
  '/Lotus/Types/Gameplay/Tau/Resources/TwelveResourceRareItem': ['Resource', 'Servoris.png'],
  '/Lotus/Types/Gameplay/Tau/Resources/TwelveResourceUncommonItem': ['Resource', 'Laudavi.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/ArachnoidCamperItem': ['Resource', 'CrismaToroid.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/ArachnoidCamperTerraItem': [
    'Resource',
    'LazuliteToroid.png'
  ],
  '/Lotus/Types/Gameplay/Venus/Resources/ArachnoidHungerItem': ['Resource', 'CaldaToroid.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/ArachnoidMicroidItem': ['Resource', 'VegaToroid.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/ArachnoidWraithItem': ['Resource', 'SolaToroid.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/CoolantItem': ['Resource', 'ThermalSludge.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/CorpusWidgetAItem': ['Resource', 'GyromagSystems.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/CorpusWidgetBItem': ['Resource', 'AtmoSystems.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/CorpusWidgetCItem': ['Resource', 'RepellerSystems.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/FungusHeartItem': ['Resource', 'MytocardiaSpore.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/OrokinSensorItem': ['Resource', 'OrokinMonitor.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/VenusCoconutItem': ['Resource', 'GorgaricusSpore.png'],
  '/Lotus/Types/Gameplay/Venus/Resources/VenusTreeItem': ['Resource', 'TepaNodule.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/EclipseVoidWraithItem': [
    'Resource',
    'LuaThraxPlasm.png'
  ],
  '/Lotus/Types/Gameplay/Zariman/Resources/EntropicKuvaItem': ['Resource', 'Entropic_Kuva.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/VoidAngelItem': ['Resource', 'VoidplumePinion.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/VoidWraithItem': ['Resource', 'ThraxPlasm.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/ZarimanDogTagBounty': ['Resource', 'VoidplumeQuill.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/ZarimanDogTagCommon': ['Resource', 'VoidplumeDown.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/ZarimanDogTagRare': ['Resource', 'VoidplumeCrest.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/ZarimanDogTagUncommon': [
    'Resource',
    'VoidplumeVane.png'
  ],
  '/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemA': ['Resource', 'VoidgelOrb.png'],
  '/Lotus/Types/Gameplay/Zariman/Resources/ZarimanMiscItemB': ['Resource', 'EntratiLanthorn.png'],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedCritterCommon': [
    'Conservation',
    'SlyVulpaphylaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedCritterRare': [
    'Conservation',
    'PanzerVulpaphylaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedCritterUncommon': [
    'Conservation',
    'CrescentVulpaphylaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedKdriveCommon': [
    'Conservation',
    'PurpleVelocipodTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedKdriveRare': [
    'Conservation',
    'WhiteVelocipodTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedKdriveUncommon': [
    'Conservation',
    'GreenVelocipodTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedMaggotCommon': [
    'Conservation',
    'BurrowingCryptilexTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedMaggotRare': [
    'Conservation',
    'CausticCryptilexTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedMaggotUncommon': [
    'Conservation',
    'SepticCryptilexTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedMergooCommon': [
    'Conservation',
    'CommonAvichaeaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedMergooRare': [
    'Conservation',
    'ViscidAvichaeaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedMergooUncommon': [
    'Conservation',
    'SporuleAvichaeaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedNexiferaCommon': [
    'Conservation',
    'AmethystNexiferaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedNexiferaRare': [
    'Conservation',
    'ScarletNexiferaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedNexiferaUncommon': [
    'Conservation',
    'ViridianNexiferaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedPredatorCommon': [
    'Conservation',
    'VizierPredasiteTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedPredatorRare': [
    'Conservation',
    'MedjayPredasiteTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedPredatorUncommon': [
    'Conservation',
    'PharaohPredasiteTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedZongroCommon': [
    'Conservation',
    'UmberUndazoaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedZongroRare': ['Conservation', 'HowlerUndazoaTag.png'],
  '/Lotus/Types/Items/Deimos/AnimalTagInfestedZongroUncommon': [
    'Conservation',
    'VaporousUndazoaTag.png'
  ],
  '/Lotus/Types/Items/Deimos/EntratiFragmentCommonA': ['Resource', 'OtakToken.png'],
  '/Lotus/Types/Items/Deimos/EntratiFragmentCommonB': ['Resource', 'SonToken.png'],
  '/Lotus/Types/Items/Deimos/EntratiFragmentCommonC': ['Resource', 'DaughterToken.png'],
  '/Lotus/Types/Items/Deimos/EntratiFragmentRareA': ['Resource', 'GrandmotherToken.png'],
  '/Lotus/Types/Items/Deimos/EntratiFragmentUncommonA': ['Resource', 'FatherToken.png'],
  '/Lotus/Types/Items/Deimos/EntratiFragmentUncommonB': ['Resource', 'MotherToken.png'],
  '/Lotus/Types/Items/Deimos/SeriglassShard': ['Resource', 'SeriglassShard.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagCondrocCommon': ['Conservation', 'CommonCondrocTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagCondrocRare': ['Conservation', 'EmperorCondrocTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagCondrocUncommon': ['Conservation', 'RogueCondrocTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagKuakaCommon': ['Conservation', 'PlainsKuakaTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagKuakaRare': ['Conservation', 'GhostKuakaTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagKuakaUncommon': ['Conservation', 'AshenKuakaTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagMergooCommon': ['Conservation', 'CoastalMergooTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagMergooRare': ['Conservation', 'SplendidMergooTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagMergooUncommon': ['Conservation', 'WoodlandMergooTag.png'],
  '/Lotus/Types/Items/Eidolon/AnimalTagVampireKavatCommon': [
    'Conservation',
    'OstiaVascaKavatTag.png'
  ],
  '/Lotus/Types/Items/Eidolon/AnimalTagVampireKavatRare': [
    'Conservation',
    'NephilVascaKavatTag.png'
  ],
  '/Lotus/Types/Items/Eidolon/AnimalTagVampireKavatUncommon': [
    'Conservation',
    'BauVascaKavatTag.png'
  ],
  '/Lotus/Types/Items/Events/AmbulasDataFragment': ['Resource', 'AnimoNavBeacon.png'],
  '/Lotus/Types/Items/Events/OperationsCredits': ['Event', 'ScarletCredits.png'],
  '/Lotus/Types/Items/Events/RelayReconstructionItemA': [
    'Resource',
    'LotusLanguageItemsRelayreconstructionitemaname.png'
  ],
  '/Lotus/Types/Items/Events/RelayReconstructionItemB': [
    'Resource',
    'LotusLanguageItemsRelayreconstructionitembname.png'
  ],
  '/Lotus/Types/Items/Events/RelayReconstructionItemC': [
    'Resource',
    'LotusLanguageItemsRelayreconstructionitemcname.png'
  ],
  '/Lotus/Types/Items/Events/TennoConRelay2026EarlyAccess': ['Event', 'BaroRelayTicket.png'],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosGenericInfestedFishPartItem': [
    'Fish Part',
    'FermentBladder.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosGenericOrokinFishPartItem': [
    'Fish Part',
    'TubercularGillSystem.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosGenericSharedFishPartItem': [
    'Fish Part',
    'BenignInfestedTumor.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosInfestedFishAPartItem': [
    'Fish Part',
    'PustulentCognitiveNodule.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosInfestedFishBPartItem': [
    'Fish Part',
    'DendriteBlastoma.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosInfestedFishCPartItem': [
    'Fish Part',
    'SaturatedMuscleMass.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosInfestedFishDPartItem': [
    'Fish Part',
    'WaxenSebumDeposit.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosInfestedFishEPartItem': [
    'Fish Part',
    'SporulateSac.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosInfestedFishFPartItem': [
    'Fish Part',
    'OcularStem-Root.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosInfestedFishGPartItem': [
    'Fish Part',
    'ParasiticTethermaw.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosOrokinFishAPartItem': [
    'Fish Part',
    'BioticFilter.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosOrokinFishBPartItem': [
    'Fish Part',
    'SpinalCoreSection.png'
  ],
  '/Lotus/Types/Items/Fish/Deimos/FishParts/DeimosOrokinFishCPartItem': [
    'Fish Part',
    'CranialForemount.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/BothCommonFishAPartItem': [
    'Fish Part',
    'CharcElectroplax.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/BothCommonFishBPartItem': [
    'Fish Part',
    'GoopollaSpleen.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/BothRareFishAPartItem': [
    'Fish Part',
    'MurkrayLiver.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/BothUncommonFishAPartItem': [
    'Fish Part',
    'SharracTeeth.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/BothUncommonFishBPartItem': [
    'Fish Part',
    'KarkinaAntenna.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/DayCommonFishAPartItem': [
    'Fish Part',
    'MawfishBones.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/DayCommonFishBPartItem': [
    'Fish Part',
    'Khut-KhutVenomSac.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/DayCommonFishCPartItem': [
    'Fish Part',
    'YogwunStomach.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/DayUncommonFishAPartItem': [
    'Fish Part',
    'TralokEyes.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/DayUncommonFishBPartItem': [
    'Fish Part',
    'MortusHorn.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishMeatItem': ['Fish Part', 'FishMeat.png'],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishOilItem': ['Fish Part', 'FishOil.png'],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/EidolonFishScalesItem': [
    'Fish Part',
    'FishScales.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/NightLegendaryFishAPartItem': [
    'Fish Part',
    'SeramBeetleShell.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/NightRareFishAPartItem': [
    'Fish Part',
    'NorgBrain.png'
  ],
  '/Lotus/Types/Items/Fish/Eidolon/FishParts/NightRareFishBPartItem': [
    'Fish Part',
    'CutholTendrils.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/CorpusFishAnoscopicSensorItem': [
    'Fish Part',
    'EchowinderAnoscopicSensor.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/CorpusFishExaBrainItem': [
    'Fish Part',
    'ScrubberExaBrain.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/CorpusFishMuonBatteryItem': [
    'Fish Part',
    'BrickieMuonBattery.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/CorpusFishParralelBiodeItem': [
    'Fish Part',
    'MirewinderParallelBiode.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/CorpusFishRotobladeItem': [
    'Fish Part',
    'Eye-EyeRotoblade.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/CorpusFishThermalLaserItem': [
    'Fish Part',
    'KrillerThermalLaser.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/CorpusFishVenedoCaseItem': [
    'Fish Part',
    'SapcaddyVenedoCase.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/OrokinFishEcosynthAnalyzerItem': [
    'Fish Part',
    'SynathidEcosynthAnalyzer.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/OrokinFishEntroplasmaItem': [
    'Fish Part',
    'TromyzonEntroplasma.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/OrokinFishSaganModuleItem': [
    'Fish Part',
    'CharamoteSaganModule.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/SolarisFishDissipatorCoilItem': [
    'Fish Part',
    'TinkDissipatorCoil.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/SolarisFishLatheCoogulantItem': [
    'Fish Part',
    'LongwinderLatheCoagulant.png'
  ],
  '/Lotus/Types/Items/Fish/Solaris/FishParts/SolarisFishNeuralRelayItem': [
    'Fish Part',
    'RecasterNeuralRelay.png'
  ],
  '/Lotus/Types/Items/FusionTreasures/OroFusexOrnamentA': ['Resource', 'AyatanCyanStar.png'],
  '/Lotus/Types/Items/FusionTreasures/OroFusexOrnamentB': ['Resource', 'AyatanAmberStar.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosCommonGemACutItem': ['Gem', 'FacetedTiametrite.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosCommonGemBCutItem': ['Gem', 'PurgedDagonic.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosCommonOreAAlloyItem': ['Ore', 'AdramalAlloy.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosCommonOreBAlloyItem': ['Ore', 'TemperedBapholite.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosEidolonGemACutItem': ['Gem', 'TrapeziumXenorhast.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosEidolonGemBCutItem': ['Gem', 'CabochonEmbolos.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosRareGemACutItem': ['Gem', 'StellatedNecrathene.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosRareOreAAlloyItem': ['Ore', 'ThaumicDistillate.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosUncommonGemACutItem': ['Gem', 'PurifiedHeciphron.png'],
  '/Lotus/Types/Items/Gems/Deimos/DeimosUncommonOreAAlloyItem': ['Ore', 'DevolvedNamalon.png'],
  '/Lotus/Types/Items/Gems/Eidolon/CommonGemACutAItem': ['Gem', 'TearAzurite.png'],
  '/Lotus/Types/Items/Gems/Eidolon/CommonGemBCutAItem': ['Gem', 'EsherDevar.png'],
  '/Lotus/Types/Items/Gems/Eidolon/CommonOreAAlloyAItem': ['Ore', 'PyroticAlloy.png'],
  '/Lotus/Types/Items/Gems/Eidolon/CommonOreBAlloyBItem': ['Ore', 'CopriteAlloy.png'],
  '/Lotus/Types/Items/Gems/Eidolon/EidolonGemACutAItem': ['Gem', 'RadianSentirum.png'],
  '/Lotus/Types/Items/Gems/Eidolon/EidolonGemBCutAItem': ['Gem', 'HeartNyth.png'],
  '/Lotus/Types/Items/Gems/Eidolon/RareGemACutAItem': ['Gem', 'StarCrimzian.png'],
  '/Lotus/Types/Items/Gems/Eidolon/RareOreAAlloyAItem': ['Ore', 'AuroxiumAlloy.png'],
  '/Lotus/Types/Items/Gems/Eidolon/UncommonGemACutAItem': ['Gem', 'MarquiseVeridos.png'],
  '/Lotus/Types/Items/Gems/Eidolon/UncommonOreAAlloyAItem': ['Ore', 'FersteelAlloy.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisCommonGemACutItem': ['Gem', 'SmoothPhasmin.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisCommonGemBCutItem': ['Gem', 'HeartNoctrul.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisCommonOreAAlloyItem': ['Ore', 'TravocyteAlloy.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisCommonOreBAlloyItem': ['Ore', 'AxidrolAlloy.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisEidolonGemACutItem': ['Gem', 'RadiantZodian.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisEidolonGemBCutItem': ['Gem', 'MarquiseThyst.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisRareGemACutItem': ['Gem', 'StarAmarast.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisRareOreAAlloyItem': ['Ore', 'HespazymAlloy.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisUncommonGemACutItem': ['Gem', 'GobliteTears.png'],
  '/Lotus/Types/Items/Gems/Solaris/SolarisUncommonOreAAlloyItem': ['Ore', 'VenerdoAlloy.png'],
  '/Lotus/Types/Items/MiscItems/1999ConquestBucks': ['Currency', 'PixChip.png'],
  '/Lotus/Types/Items/MiscItems/Alertium': ['Resource', 'NitainExtract.png'],
  '/Lotus/Types/Items/MiscItems/AlloyPlate': ['Resource', 'AlloyPlate.png'],
  '/Lotus/Types/Items/MiscItems/AntiSerumInjector': ['Event', 'ZealotDerelictCode.png'],
  '/Lotus/Types/Items/MiscItems/ArgonCrystal': ['Resource', 'ArgonCrystal.png'],
  '/Lotus/Types/Items/MiscItems/Beacon': ['Resource', 'NavCoordinate.png'],
  '/Lotus/Types/Items/MiscItems/CodaWeaponBucks': ['Resource', 'LiveHeartcell.png'],
  '/Lotus/Types/Items/MiscItems/ControlModule': ['Resource', 'ControlModule.png'],
  '/Lotus/Types/Items/MiscItems/DagathAbyssItem': ['Resource', 'Vainthorn.png'],
  '/Lotus/Types/Items/MiscItems/DataFragment': ['Event', 'TethraDataFragments.png'],
  '/Lotus/Types/Items/MiscItems/Eidolonium': ['Resource', 'BreathOfTheEidolon.png'],
  '/Lotus/Types/Items/MiscItems/Elitium': ['Resource', 'VitusEssence.png'],
  '/Lotus/Types/Items/MiscItems/Fissureum': ['Event', 'DilutedThermia.png'],
  '/Lotus/Types/Items/MiscItems/FocusLens': ['Resource', 'FocusLens.png'],
  '/Lotus/Types/Items/MiscItems/FocusLensGreater': ['Resource', 'GreaterFocusLens.png'],
  '/Lotus/Types/Items/MiscItems/FocusLensLua': ['Resource', 'LuaLens.png'],
  '/Lotus/Types/Items/MiscItems/FocusLensOstron': ['Resource', 'EidolonLens.png'],
  '/Lotus/Types/Items/MiscItems/FoilModUnlocker': ['Resource', 'ChromaticAtramentum.png'],
  '/Lotus/Types/Items/MiscItems/GranumBucks': ['Resource', 'CorruptedHolokey.png'],
  '/Lotus/Types/Items/MiscItems/GrnFlameSpearPart': ['Resource', 'JavlokCapacitor.png'],
  '/Lotus/Types/Items/MiscItems/InfestedAladCoordinate': [
    'Resource',
    'MutalistAladVNavCoordinate.png'
  ],
  '/Lotus/Types/Items/MiscItems/JuggernautPartA': ['Resource', 'PulsatingTubercles.png'],
  '/Lotus/Types/Items/MiscItems/JuggernautPartB': ['Resource', 'InfectedPalpators.png'],
  '/Lotus/Types/Items/MiscItems/JuggernautPartC': ['Resource', 'ChitinousHusk.png'],
  '/Lotus/Types/Items/MiscItems/JuggernautPartD': ['Resource', 'SeveredBileSac.png'],
  '/Lotus/Types/Items/MiscItems/KahlCreds': ['Currency', 'KahlStock.png'],
  '/Lotus/Types/Items/MiscItems/KelaArenaToken': ['Resource', 'JudgementPoints.png'],
  '/Lotus/Types/Items/MiscItems/LastWishItems/BlueCrystal': [
    'Resource',
    'BelricCrystalFragment.png'
  ],
  '/Lotus/Types/Items/MiscItems/LastWishItems/RedCrystal': ['Resource', 'RaniaCrystalFragment.png'],
  '/Lotus/Types/Items/MiscItems/MechSurvivalEventCreds': ['Event', 'PhasicCells.png'],
  '/Lotus/Types/Items/MiscItems/MemoryCryptoFragment': ['Resource', 'SomaticFibers.png'],
  '/Lotus/Types/Items/MiscItems/MirageCode': ['Resource', 'OrokinCipher.png'],
  '/Lotus/Types/Items/MiscItems/MushroomFood': ['Resource', 'Fergolyte.png'],
  '/Lotus/Types/Items/MiscItems/Nanospores': ['Resource', 'NanoSpores.png'],
  '/Lotus/Types/Items/MiscItems/NarmerBountyResource': ['Resource', 'NarmerIsoplast.png'],
  '/Lotus/Types/Items/MiscItems/NavCode': ['Resource', 'NavCoordinate.png'],
  '/Lotus/Types/Items/MiscItems/NeuralSensor': ['Resource', 'NeuralSensors.png'],
  '/Lotus/Types/Items/MiscItems/NoraInfestedCreds': ['Currency', 'EmissaryCred64.png'],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionEightCreds': ['Currency', "Nora'sMixVol4Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionElevenCreds': ['Currency', "Nora'sMixVol7Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionFifteenCreds': [
    'Currency',
    "Nora'sMixTimeTempestsCred.png"
  ],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionFiveCreds': ['Currency', "Nora'sMixVol1Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionFourCreds': ['Currency', 'NoraCredOfferings.png'],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionFourteenCreds': [
    'Currency',
    "Nora'sMixDreamsoftheDeadCred.png"
  ],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionNineCreds': ['Currency', "Nora'sMixVol5Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionSevenCreds': ['Currency', "Nora'sMixVol2Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionSixCreds': ['Currency', "Nora'sMixVol2Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionSixteenCreds': [
    'Currency',
    "Amir'sShockwaveCred.png"
  ],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionTenCreds': ['Currency', "Nora'sMixVol6Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionThirteenCreds': [
    'Currency',
    "Nora'sMixVol9Cred.png"
  ],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionThreeCreds': ['Currency', 'Nora3Cred64.png'],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionTwelveCreds': ['Currency', "Nora'sMixVol8Cred.png"],
  '/Lotus/Types/Items/MiscItems/NoraIntermissionTwoCreds': ['Currency', 'Nora2Cred64.png'],
  '/Lotus/Types/Items/MiscItems/NoraWolfCreds': ['Currency', 'WolfCred64.png'],
  '/Lotus/Types/Items/MiscItems/NoraWolfTwoCreds': ['Currency', 'NoraCred64.png'],
  '/Lotus/Types/Items/MiscItems/OmegaIsotope': ['Event', 'OmegaIsotope.png'],
  '/Lotus/Types/Items/MiscItems/OrokinCell': ['Resource', 'OrokinCell.png'],
  '/Lotus/Types/Items/MiscItems/PolymerBundle': ['Resource', 'PolymerBundle.png'],
  '/Lotus/Types/Items/MiscItems/PrimeBucks': ['Currency', 'OrokinDucats.png'],
  '/Lotus/Types/Items/MiscItems/RazorbackCipherPart': ['Event', 'CryptographicALU.png'],
  '/Lotus/Types/Items/MiscItems/RivenFragment': ['Resource', 'RivenSliver.png'],
  '/Lotus/Types/Items/MiscItems/RivenSplicer': ['Resource', 'RivenSplicer.png'],
  '/Lotus/Types/Items/MiscItems/SchismKey': ['Currency', 'Aya.png'],
  '/Lotus/Types/Items/MiscItems/SentientFragmentLootItem': ['Resource', 'AnomalyShard.png'],
  '/Lotus/Types/Items/MiscItems/ShrineFragment': ['Resource', 'FatePearl.png'],
  '/Lotus/Types/Items/MiscItems/SpecterParticleResidue': ['Resource', 'SpectralDebris.png'],
  '/Lotus/Types/Items/MiscItems/SteelEssence': ['Resource', 'SteelEssence.png'],
  '/Lotus/Types/Items/MiscItems/SyringeComponent': ['Research', 'AntiserumInjectorFragment.png'],
  '/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentA': ['Event', 'NavCodeVayHekA.png'],
  '/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentB': ['Event', 'NavCodeVayHekB.png'],
  '/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentC': ['Event', 'NavCodeVayHekC.png'],
  '/Lotus/Types/Items/MiscItems/VayHekCoordinateFragmentD': ['Event', 'NavCodeVayHekD.png'],
  '/Lotus/Types/Items/MiscItems/VoidTearDrop': ['Resource', 'VoidTraces.png'],
  '/Lotus/Types/Items/MiscItems/WaterFightBucks': ['Event', 'NakakPearl.png'],
  '/Lotus/Types/Items/MushroomJournal/BlastMushroomJournalItem': ['Resource', 'SpringPopper.png'],
  '/Lotus/Types/Items/MushroomJournal/ColdMushroomJournalItem': ['Resource', 'WinterSpear.png'],
  '/Lotus/Types/Items/MushroomJournal/CorrosiveMushroomJournalItem': ['Resource', 'Borica.png'],
  '/Lotus/Types/Items/MushroomJournal/ElectricityMushroomJournalItem': [
    'Resource',
    'Thunder-Button.png'
  ],
  '/Lotus/Types/Items/MushroomJournal/GasMushroomJournalItem': ['Resource', 'ReekingPuffball.png'],
  '/Lotus/Types/Items/MushroomJournal/HeatMushroomJournalItem': ['Resource', 'BlisterStalk.png'],
  '/Lotus/Types/Items/MushroomJournal/ImpactMushroomJournalItem': ['Resource', 'Ironwood.png'],
  '/Lotus/Types/Items/MushroomJournal/MagneticMushroomJournalItem': ['Resource', 'Ferrofungus.png'],
  '/Lotus/Types/Items/MushroomJournal/PlainMushroomJournalItem': ['Resource', 'DullButton.png'],
  '/Lotus/Types/Items/MushroomJournal/PunctureMushroomJournalItem': ['Resource', 'ThornTooth.png'],
  '/Lotus/Types/Items/MushroomJournal/RadiationMushroomJournalItem': ['Resource', 'GammaBerry.png'],
  '/Lotus/Types/Items/MushroomJournal/SlashMushroomJournalItem': ['Resource', "Devil'sCap.png"],
  '/Lotus/Types/Items/MushroomJournal/TauMushroomJournalItem': ['Resource', 'VomvalTrumpet.png'],
  '/Lotus/Types/Items/MushroomJournal/ToxinMushroomJournalItem': ['Resource', 'MuckBonnet.png'],
  '/Lotus/Types/Items/MushroomJournal/ViralMushroomJournalItem': ['Resource', "Violet'sBane.png"],
  '/Lotus/Types/Items/MushroomJournal/VoidMushroomJournalItem': ['Resource', 'Nonono.png'],
  '/Lotus/Types/Items/Plants/MiscItems/CommonDayPlantItem': ['Plant', 'SunlightThreshcone.png'],
  '/Lotus/Types/Items/Plants/MiscItems/CommonNightPlantItem': ['Plant', 'MoonlightThreshcone.png'],
  '/Lotus/Types/Items/Plants/MiscItems/GftPlantRuksClawMaturePlantItem': ['Plant', "Ruk'sClaw.png"],
  '/Lotus/Types/Items/Plants/MiscItems/GofPlantAPlantItem': [
    'Plant',
    'LotusLanguageScansGofplantaplantname.png'
  ],
  '/Lotus/Types/Items/Plants/MiscItems/GofPlantEPlantItem': [
    'Plant',
    'LotusLanguageScansGofplanteplantname.png'
  ],
  '/Lotus/Types/Items/Plants/MiscItems/IresPlantItem': ['Plant', 'SkateweedExtract.png'],
  '/Lotus/Types/Items/Plants/MiscItems/MossGroundCoverAPlantItem': ['Plant', 'VestanMoss.png'],
  '/Lotus/Types/Items/Plants/MiscItems/OroFungusAPlantItem': ['Plant', 'CeruleanFungusExtract.png'],
  '/Lotus/Types/Items/Plants/MiscItems/OroPorcelainBushAPlantItem': [
    'Plant',
    'GhostBrushExtract.png'
  ],
  '/Lotus/Types/Items/Plants/MiscItems/RareDayPlantItem': ['Plant', 'SunlightJadeleaf.png'],
  '/Lotus/Types/Items/Plants/MiscItems/RareNightPlantItem': ['Plant', 'MoonlightJadeleaf.png'],
  '/Lotus/Types/Items/Plants/MiscItems/UnCommonDayPlantItem': ['Plant', 'SunlightDragonlily.png'],
  '/Lotus/Types/Items/Plants/MiscItems/UnCommonNightPlantItem': [
    'Plant',
    'MoonlightDragonlily.png'
  ],
  '/Lotus/Types/Items/Plants/MiscItems/ZenCobraLotusPlantItem': [
    'Plant',
    'DusklightSarracenia.png'
  ],
  '/Lotus/Types/Items/Plants/MiscItems/ZenPitcherPlantItem': ['Plant', 'LunarPitcher.png'],
  '/Lotus/Types/Items/RailjackMiscItems/AucruxRailjackItem': ['Resource', 'AucruxCapacitors.png'],
  '/Lotus/Types/Items/RailjackMiscItems/CubicsRailjackItem': ['Resource', 'CubicDiodes.png'],
  '/Lotus/Types/Items/RailjackMiscItems/GallosRailjackItem': ['Resource', 'GallosRods.png'],
  '/Lotus/Types/Items/RailjackMiscItems/ScrapRailjackItem': ['Resource', 'TicorPlate.png'],
  '/Lotus/Types/Items/RelayRebuild/PhaseOneClanItem': ['Resource', 'ThermicStrut.png'],
  '/Lotus/Types/Items/RelayRebuild/PhaseOneFireElement': ['Event', 'PyrusEssence.png'],
  '/Lotus/Types/Items/RelayRebuild/PhaseOneWaterElement': [
    'Resource',
    'LotusLanguageRelayreconstructionRelayreconphase1leftitemname.png'
  ],
  '/Lotus/Types/Items/RelayRebuild/PhaseThreeAirEssence': [
    'Resource',
    'LotusLanguageRelayreconstructionRelayreconphase3leftitemname.png'
  ],
  '/Lotus/Types/Items/RelayRebuild/PhaseThreeClanItem': [
    'Resource',
    'LotusLanguageRelayreconstructionRelayreconphase3clanitemname.png'
  ],
  '/Lotus/Types/Items/RelayRebuild/PhaseThreeEarthEssence': ['Event', 'TremberaEssence.png'],
  '/Lotus/Types/Items/RelayRebuild/PhaseTwoClanItem': [
    'Resource',
    'LotusLanguageRelayreconstructionRelayreconphase2clanitemname.png'
  ],
  '/Lotus/Types/Items/RelayRebuild/PhaseTwoPigmentBright': [
    'Resource',
    'LotusLanguageRelayreconstructionRelayreconphase2aleftitemname.png'
  ],
  '/Lotus/Types/Items/RelayRebuild/PhaseTwoPigmentMuted': [
    'Resource',
    'LotusLanguageRelayreconstructionRelayreconphase2arightitemname.png'
  ],
  '/Lotus/Types/Items/Research/BioComponent': ['Resource', 'MutagenMass.png'],
  '/Lotus/Types/Items/Research/BioFragment': ['Research', 'MutagenSample.png'],
  '/Lotus/Types/Items/Research/ChemComponent': ['Resource', 'DetoniteInjector.png'],
  '/Lotus/Types/Items/Research/ChemFragment': ['Research', 'DetoniteAmpule.png'],
  '/Lotus/Types/Items/Research/CipherPlus': ['Event', 'CorpusCipher.png'],
  '/Lotus/Types/Items/Research/DataMassPlus': ['Event', 'CorpusDatamass.png'],
  '/Lotus/Types/Items/Research/DojoColors/GenericDojoColorPigment': [
    'Resource',
    'GenericDojoColorPigment.png'
  ],
  '/Lotus/Types/Items/Research/EnergyFragment': ['Research', 'FieldronSample.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagBolarolaCommon': ['Conservation', 'SpottedBolarolaTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagBolarolaRare': ['Conservation', 'ThornyBolarolaTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagBolarolaUncommon': [
    'Conservation',
    'Black-BandedBolarolaTag.png'
  ],
  '/Lotus/Types/Items/Solaris/AnimalTagHorrasqueCommon': [
    'Conservation',
    'DappledHorrasqueTag.png'
  ],
  '/Lotus/Types/Items/Solaris/AnimalTagHorrasqueRare': ['Conservation', 'HorrasqueStormerTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagHorrasqueUncommon': [
    'Conservation',
    'SwimmerHorrasqueTag.png'
  ],
  '/Lotus/Types/Items/Solaris/AnimalTagKubrodonCommon': ['Conservation', 'BrindleKubrodonTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagKubrodonRare': [
    'Conservation',
    'KubrodonIncarnadineTag.png'
  ],
  '/Lotus/Types/Items/Solaris/AnimalTagKubrodonUncommon': ['Conservation', 'VallisKubrodonTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagPobbersCommon': ['Conservation', 'SunnyPobberTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagPobbersRare': ['Conservation', 'SubterraneanPobberTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagPobbersUncommon': ['Conservation', 'DelicatePobberTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagSawgawCommon': ['Conservation', 'FlossySawgawTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagSawgawRare': ['Conservation', 'FrogmouthedSawgawTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagSawgawUncommon': [
    'Conservation',
    'AlpineMonitorSawgawTag.png'
  ],
  '/Lotus/Types/Items/Solaris/AnimalTagStoverCommon': ['Conservation', 'SentinelStoverTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagStoverRare': ['Conservation', 'Fire-VeinedStoverTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagStoverUncommon': ['Conservation', 'FumingDaxStoverTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagVirminkCommon': [
    'Conservation',
    'White-BreastedVirminkTag.png'
  ],
  '/Lotus/Types/Items/Solaris/AnimalTagVirminkRare': ['Conservation', 'Red-CrestedVirminkTag.png'],
  '/Lotus/Types/Items/Solaris/AnimalTagVirminkUncommon': [
    'Conservation',
    'Dusky-HeadedVirminkTag.png'
  ],
  '/Lotus/Types/Items/Solaris/DebtTokenA': ['Resource', 'TrainingDebt-Bond.png'],
  '/Lotus/Types/Items/Solaris/DebtTokenB': ['Resource', 'ShelterDebt-Bond.png'],
  '/Lotus/Types/Items/Solaris/DebtTokenC': ['Resource', 'MedicalDebt-Bond.png'],
  '/Lotus/Types/Items/Solaris/DebtTokenD': ['Resource', 'AdvancesDebt-Bond.png'],
  '/Lotus/Types/Items/Solaris/DebtTokenE': ['Resource', 'FamilialDebt-Bond.png'],
  '/Lotus/Types/Items/SyndicateDogTags/ArbitersDogTag': ['Resource', 'Medallion.png'],
  '/Lotus/Types/Items/SyndicateDogTags/ArbitersRareDogTag': ['Resource', 'MaximMedallion.png'],
  '/Lotus/Types/Items/SyndicateDogTags/ArbitersUncommonDogTag': ['Resource', 'LawfulMedallion.png'],
  '/Lotus/Types/Items/SyndicateDogTags/CephalonDogTag': ['Resource', 'Datum.png'],
  '/Lotus/Types/Items/SyndicateDogTags/CephalonRareDogTag': ['Resource', 'GeniusDatum.png'],
  '/Lotus/Types/Items/SyndicateDogTags/CephalonUncommonDogTag': ['Resource', 'IntriguingDatum.png'],
  '/Lotus/Types/Items/SyndicateDogTags/NewLokaDogTag': ['Resource', 'Seed.png'],
  '/Lotus/Types/Items/SyndicateDogTags/NewLokaRareDogTag': ['Resource', 'FlawlessSeed.png'],
  '/Lotus/Types/Items/SyndicateDogTags/NewLokaUncommonDogTag': ['Resource', 'BountifulSeed.png'],
  '/Lotus/Types/Items/SyndicateDogTags/PerrinDogTag': ['Resource', 'Quittance.png'],
  '/Lotus/Types/Items/SyndicateDogTags/PerrinRareDogTag': ['Resource', 'PartnerQuittance.png'],
  '/Lotus/Types/Items/SyndicateDogTags/PerrinUncommonDogTag': [
    'Resource',
    'ExecutiveQuittance.png'
  ],
  '/Lotus/Types/Items/SyndicateDogTags/RedVeilDogTag': ['Resource', 'Mark.png'],
  '/Lotus/Types/Items/SyndicateDogTags/RedVeilRareDogTag': ['Resource', 'ExaltedMark.png'],
  '/Lotus/Types/Items/SyndicateDogTags/RedVeilUncommonDogTag': ['Resource', 'HonoredMark.png'],
  '/Lotus/Types/Items/SyndicateDogTags/SteelMeridianDogTag': ['Resource', 'Insignia.png'],
  '/Lotus/Types/Items/SyndicateDogTags/SteelMeridianRareDogTag': [
    'Resource',
    'GeneralInsignia.png'
  ],
  '/Lotus/Types/Items/SyndicateDogTags/SteelMeridianUncommonDogTag': [
    'Resource',
    'DefenderInsignia.png'
  ],
  '/Lotus/Types/Items/SyndicateDogTags/UniversalSyndicateDogTag': [
    'Resource',
    'UniversalMedallion.png'
  ],
  '/Lotus/Types/Items/Tokens/GreedTokens/GreedTokenBlack': ['Resource', 'ZenithGranumCrown.png'],
  '/Lotus/Types/Items/Tokens/GreedTokens/GreedTokenBlue': ['Resource', 'GranumCrown.png'],
  '/Lotus/Types/Items/Tokens/GreedTokens/GreedTokenGold': ['Resource', 'ExemplarGranumCrown.png'],
  '/Lotus/Types/Items/Zariman/Fluxyte': ['Currency', 'Argozene.png'],
  '/Lotus/Types/Keys/BardQuest/BardQuestSequencerPartA': ['Resource', 'MandachordBody.png'],
  '/Lotus/Types/Keys/BardQuest/BardQuestSequencerPartB': ['Resource', 'MandachordFret.png'],
  '/Lotus/Types/Keys/BardQuest/BardQuestSequencerPartC': ['Resource', 'MandachordBridge.png'],
  '/Lotus/Types/Keys/NightmareRetrievalKeyBlueprint': ['Event', 'TethraShieldCipher.png'],
  '/Lotus/Types/Keys/RetrievalKeyBlueprint': ['Event', 'TethraCipher.png'],
  '/Lotus/Types/PickUps/Nightwave/CephalonFissureTimePointItem': [
    'Event',
    'CephaliteResonance.png'
  ],
  '/Lotus/Types/Recipes/WarframeRecipes/ChromaBeaconAComponent': [
    'Resource',
    'ScorchedBeacon64.png'
  ],
  '/Lotus/Types/Recipes/WarframeRecipes/ChromaBeaconBComponent': ['Resource', 'ChromaSignal64.png'],
  '/Lotus/Types/Recipes/WarframeRecipes/ChromaBeaconCComponent': ['Resource', 'ChromaMark64.png'],
  '/Lotus/Types/Restoratives/Consumable/AlphaCorruptor': ['Event', 'AlphaCorruptor.png'],
  '/Lotus/Types/Restoratives/Consumable/BetaCorruptor': ['Event', 'BetaCorruptor.png'],
  '/Lotus/Types/Restoratives/Consumable/StableCorruptor': ['Event', 'StableCorruptor.png'],
  '/Lotus/Upgrades/Focus/AttackLens': ['Resource', 'FocusLens.png'],
  '/Lotus/Upgrades/Focus/AttackLensGreater': ['Resource', 'GreaterFocusLens.png'],
  '/Lotus/Upgrades/Focus/AttackLensLua': ['Resource', 'LuaLens.png'],
  '/Lotus/Upgrades/Focus/AttackLensOstron': ['Resource', 'EidolonLens.png'],
  '/Lotus/Upgrades/Focus/DefenseLens': ['Resource', 'FocusLens.png'],
  '/Lotus/Upgrades/Focus/DefenseLensGreater': ['Resource', 'GreaterFocusLens.png'],
  '/Lotus/Upgrades/Focus/DefenseLensLua': ['Resource', 'LuaLens.png'],
  '/Lotus/Upgrades/Focus/DefenseLensOstron': ['Resource', 'EidolonLens.png'],
  '/Lotus/Upgrades/Focus/PowerLens': ['Resource', 'FocusLens.png'],
  '/Lotus/Upgrades/Focus/PowerLensGreater': ['Resource', 'GreaterFocusLens.png'],
  '/Lotus/Upgrades/Focus/PowerLensLua': ['Resource', 'LuaLens.png'],
  '/Lotus/Upgrades/Focus/PowerLensOstron': ['Resource', 'EidolonLens.png'],
  '/Lotus/Upgrades/Focus/TacticLens': ['Resource', 'FocusLens.png'],
  '/Lotus/Upgrades/Focus/TacticLensGreater': ['Resource', 'GreaterFocusLens.png'],
  '/Lotus/Upgrades/Focus/TacticLensLua': ['Resource', 'LuaLens.png'],
  '/Lotus/Upgrades/Focus/TacticLensOstron': ['Resource', 'EidolonLens.png'],
  '/Lotus/Upgrades/Focus/WardLens': ['Resource', 'FocusLens.png'],
  '/Lotus/Upgrades/Focus/WardLensGreater': ['Resource', 'GreaterFocusLens.png'],
  '/Lotus/Upgrades/Focus/WardLensLua': ['Resource', 'LuaLens.png'],
  '/Lotus/Upgrades/Focus/WardLensOstron': ['Resource', 'EidolonLens.png'],
  PlatinumCredits: ['Currency', 'PlatinumLarge.png'],
  PrimeToken: ['Currency', 'RegalAya.png']
}
