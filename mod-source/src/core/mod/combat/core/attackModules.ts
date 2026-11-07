import AntiBuller from "@combat-modules/AntiBuller";
import AppleInstakiller from "@combat-modules/AppleInstakiller";
import AutoAttacker from "@combat-modules/AutoAttacker";
import AutoInstakiller from "@combat-modules/AutoInstakiller";
import AutoMeleeSyncer from "@combat-modules/AutoMeleeSyncer";
import AutoPusherStriker from "@combat-modules/AutoPushStriker";
import BarbarianKnockbacker from "@combat-modules/BarbarianKnockbacker";
import MusketInstakiller from "@combat-modules/MusketInstakiller";
import OneTicker from "@combat-modules/OneTicker";
import ProjectileSyncer from "@combat-modules/ProjectileSyncer";
import ShameGrinder from "@combat-modules/ShameGrinder";
import SpikeTicker from "@combat-modules/SpikeTicker";
import TurretAPAssister from "@combat-modules/TurretAPAssister";
import TurretGearKnockbacker from "@combat-modules/TurretGearKnockbacker";
import VelocityAttacker from "@combat-modules/VelocityAttacker";
import AttackManager from "@core/mod/combat/core/AttackManager";
import DefensiveKnockbacker from "@core/mod/defense/modules/DefensiveKnockbacker";

// Creates the attack modules and hands them to AttackManager. The modules import AttackManager (to queue attacks), so
// AttackManager can't import them back; ModManager loads this file instead. Same instances, same order as before.
AttackManager.spikeTicker = new SpikeTicker();
AttackManager.appleInstakiller = new AppleInstakiller();
AttackManager.shameGrinder = new ShameGrinder();
AttackManager.antiBuller = new AntiBuller();
AttackManager.oneTicker = new OneTicker();

AttackManager.modules = [
    AttackManager.antiBuller,
    new AutoInstakiller(),
    new MusketInstakiller(),
    new AutoAttacker(),
    new ProjectileSyncer(),
    new AutoPusherStriker(),
    new TurretAPAssister(),
    new VelocityAttacker(),
    new DefensiveKnockbacker(),
    new AutoMeleeSyncer(),
    new TurretGearKnockbacker(),
    new BarbarianKnockbacker(),
    // Before Apple Insta: while it grinds the enemy's shame, Apple Insta waits (holdsAppleInsta).
    AttackManager.shameGrinder,
    AttackManager.appleInstakiller,
    AttackManager.spikeTicker,
    AttackManager.oneTicker
];
