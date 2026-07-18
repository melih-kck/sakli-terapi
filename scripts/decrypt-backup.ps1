[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$resolvedInput = [IO.Path]::GetFullPath($InputPath)

if (-not [IO.File]::Exists($resolvedInput)) {
    throw "Encrypted backup not found: $resolvedInput"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = if ($resolvedInput.EndsWith('.dpapi', [StringComparison]::OrdinalIgnoreCase)) {
        $resolvedInput.Substring(0, $resolvedInput.Length - '.dpapi'.Length)
    } else {
        "$resolvedInput.zip"
    }
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
if ([IO.File]::Exists($resolvedOutput)) {
    throw "Refusing to overwrite an existing file: $resolvedOutput"
}

Add-Type -AssemblyName System.Security
$encryptedBytes = $null
$plainBytes = $null

try {
    $encryptedBytes = [IO.File]::ReadAllBytes($resolvedInput)
    $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect(
        $encryptedBytes,
        $null,
        [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    [IO.File]::WriteAllBytes($resolvedOutput, $plainBytes)

    [pscustomobject]@{
        OutputPath = $resolvedOutput
        Bytes = [IO.FileInfo]::new($resolvedOutput).Length
        SHA256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput).Hash
    }
} finally {
    if ($encryptedBytes) {
        [Array]::Clear($encryptedBytes, 0, $encryptedBytes.Length)
    }
    if ($plainBytes) {
        [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    }
}
