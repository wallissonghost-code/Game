local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local root = ReplicatedStorage:FindFirstChild("CidadeViva") or Instance.new("Folder")
root.Name = "CidadeViva"
root.Parent = ReplicatedStorage

local remotes = root:FindFirstChild("Remotes") or Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = root

local requestJob = remotes:FindFirstChild("RequestJob") or Instance.new("RemoteFunction")
requestJob.Name = "RequestJob"
requestJob.Parent = remotes

local requestBuild = remotes:FindFirstChild("RequestBuild") or Instance.new("RemoteFunction")
requestBuild.Name = "RequestBuild"
requestBuild.Parent = remotes

local JOBS = {
    Entregador = { payout = 70, cooldown = 20 },
    Motorista = { payout = 95, cooldown = 30 },
    Coletor = { payout = 60, cooldown = 18 },
    Prefeitura = { payout = 120, cooldown = 45 },
}

local lastJobAt: {[Player]: number} = {}

local function getMoney(player: Player): IntValue
    local leaderstats = player:FindFirstChild("leaderstats")
    if not leaderstats then
        leaderstats = Instance.new("Folder")
        leaderstats.Name = "leaderstats"
        leaderstats.Parent = player
    end

    local money = leaderstats:FindFirstChild("Dinheiro") :: IntValue?
    if not money then
        money = Instance.new("IntValue")
        money.Name = "Dinheiro"
        money.Value = 1250
        money.Parent = leaderstats
    end

    return money
end

Players.PlayerAdded:Connect(function(player)
    getMoney(player)
end)

Players.PlayerRemoving:Connect(function(player)
    lastJobAt[player] = nil
end)

requestJob.OnServerInvoke = function(player: Player, jobName: string)
    local job = JOBS[jobName]
    if not job then
        return false, "Emprego inválido"
    end

    local now = os.clock()
    local previous = lastJobAt[player] or 0
    if now - previous < job.cooldown then
        return false, "Aguarde para trabalhar novamente"
    end

    lastJobAt[player] = now
    local money = getMoney(player)
    money.Value += job.payout
    return true, job.payout, money.Value
end

local function overlapsExistingBuilding(cf: CFrame, size: Vector3): boolean
    local params = OverlapParams.new()
    params.FilterType = Enum.RaycastFilterType.Exclude

    local parts = workspace:GetPartBoundsInBox(cf, size, params)
    for _, part in parts do
        if part:GetAttribute("CidadeVivaBuilding") == true then
            return true
        end
        local model = part:FindFirstAncestorOfClass("Model")
        if model and model:GetAttribute("CidadeVivaBuilding") == true then
            return true
        end
    end
    return false
end

requestBuild.OnServerInvoke = function(player: Player, cf: CFrame, size: Vector3)
    if typeof(cf) ~= "CFrame" or typeof(size) ~= "Vector3" then
        return false, "Dados inválidos"
    end

    if size.X <= 0 or size.Y <= 0 or size.Z <= 0 or size.Magnitude > 400 then
        return false, "Dimensão inválida"
    end

    if overlapsExistingBuilding(cf, size) then
        return false, "Não é permitido construir dentro de outra construção"
    end

    local zone = workspace:FindFirstChild("BuildZone")
    if zone and zone:IsA("BasePart") then
        local localPos = zone.CFrame:PointToObjectSpace(cf.Position)
        local half = zone.Size * 0.5
        if math.abs(localPos.X) > half.X or math.abs(localPos.Z) > half.Z then
            return false, "Fora da área de construção"
        end
    end

    return true, "Construção liberada"
end
