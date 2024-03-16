export class KillPacket{
    constructor(playerKilledId, killerId, killerTeam, effectSpawnPos, effectDirecton){
        this.playerKilledId = playerKilledId;
        this.killerId = killerId;
        this.killerTeam = killerTeam;
    }
}