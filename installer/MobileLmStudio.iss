#define MyAppName "Mobile LM Studio"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Local Build"
#define PublishDir GetEnv("MLS_PUBLISH_DIR")
#if PublishDir == ""
  #define PublishDir "..\\artifacts\\publish\\win-x64"
#endif

[Setup]
AppId={{E4901220-35A3-4DF3-83F5-B503E4A56D90}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\MobileLmStudio
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\artifacts\installer
OutputBaseFilename=MobileLmStudioSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\scripts\install-service.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\uninstall-service.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-service.ps1"" -ServiceName ""MobileLmStudio"" -InstallPath ""{app}"""; Flags: waituntilterminated

[Code]
var
  ConfigurationPage: TWizardPage;
  PortLabel: TNewStaticText;
  PortEdit: TNewEdit;
  DataPathLabel: TNewStaticText;
  DataPathEdit: TNewEdit;
  LmStudioUrlLabel: TNewStaticText;
  LmStudioUrlEdit: TNewEdit;
  ApiKeyLabel: TNewStaticText;
  ApiKeyEdit: TNewEdit;
  McpConfigPathLabel: TNewStaticText;
  McpConfigPathEdit: TNewEdit;
  EnablePinCheckBox: TNewCheckBox;
  PinLabel: TNewStaticText;
  PinEdit: TNewEdit;
  SuccessLinkLabel: TNewStaticText;
  InstallSettingsPath: string;
  InstallFailurePath: string;
  LocalUrl: string;
  InstallSucceeded: Boolean;

procedure UpdatePinState(Sender: TObject);
begin
  PinLabel.Enabled := EnablePinCheckBox.Checked;
  PinEdit.Enabled := EnablePinCheckBox.Checked;
end;

function GetListenUrl(): string;
begin
  Result := 'http://0.0.0.0:' + Trim(PortEdit.Text);
end;

function GetLocalUrl(): string;
begin
  Result := 'http://localhost:' + Trim(PortEdit.Text);
end;

function GetSelectedPin(): string;
begin
  if EnablePinCheckBox.Checked then
    Result := PinEdit.Text
  else
    Result := '';
end;

function IsHttpUrl(const Value: string): Boolean;
var
  Normalized: string;
begin
  Normalized := Lowercase(Trim(Value));
  Result := (Pos('http://', Normalized) = 1) or (Pos('https://', Normalized) = 1);
end;

function EscapeJson(const Value: string): string;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
  StringChangeEx(Result, #13, '\r', True);
  StringChangeEx(Result, #10, '\n', True);
  StringChangeEx(Result, #9, '\t', True);
end;

function BuildInstallSettingsJson(): string;
begin
  Result :=
    '{' + #13#10 +
    '  "ListenUrl": "' + EscapeJson(GetListenUrl()) + '",' + #13#10 +
    '  "LmStudioUrl": "' + EscapeJson(Trim(LmStudioUrlEdit.Text)) + '",' + #13#10 +
    '  "LmStudioApiToken": "' + EscapeJson(ApiKeyEdit.Text) + '",' + #13#10 +
    '  "McpConfigPath": "' + EscapeJson(Trim(McpConfigPathEdit.Text)) + '",' + #13#10 +
    '  "DataPath": "' + EscapeJson(Trim(DataPathEdit.Text)) + '",' + #13#10 +
    '  "Pin": "' + EscapeJson(GetSelectedPin()) + '",' + #13#10 +
    '  "PinIterations": 100000' + #13#10 +
    '}';
end;

procedure SuccessLinkClick(Sender: TObject);
var
  ResultCode: Integer;
begin
  if LocalUrl = '' then
    Exit;

  ShellExec('open', LocalUrl, '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
end;

procedure RunServiceInstall();
var
  PowerShellPath: string;
  Parameters: string;
  ResultCode: Integer;
  ErrorDetails: AnsiString;
begin
  PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  InstallFailurePath := ExpandConstant('{tmp}\mobile-lm-studio-install-error.txt');
  if FileExists(InstallFailurePath) then
    DeleteFile(InstallFailurePath);

  Parameters :=
    '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\install-service.ps1') + '"' +
    ' -InstallPath "' + ExpandConstant('{app}') + '"' +
    ' -SettingsPath "' + InstallSettingsPath + '"' +
    ' -FailurePath "' + InstallFailurePath + '"' +
    ' -SkipCopy';

  WizardForm.StatusLabel.Caption := 'Registering the Mobile LM Studio Windows service...';
  Log('Running install-service.ps1 for final configuration.');

  if not Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    RaiseException('Setup could not launch PowerShell to register the Mobile LM Studio service.');

  if ResultCode <> 0 then
  begin
    ErrorDetails := '';
    if FileExists(InstallFailurePath) then
    begin
      if LoadStringFromFile(InstallFailurePath, ErrorDetails) then
        ErrorDetails := Trim(ErrorDetails);
    end;

    if ErrorDetails <> '' then
      RaiseException('Mobile LM Studio files were copied, but the Windows service registration failed:' + #13#10#13#10 + ErrorDetails + #13#10#13#10 + 'Check %PROGRAMDATA%\MobileLmStudio\logs for service diagnostics.')
    else
      RaiseException('Mobile LM Studio files were copied, but the Windows service registration failed. Check %PROGRAMDATA%\MobileLmStudio\logs and run scripts\\install-service.ps1 manually to finish setup.');
  end;

  InstallSucceeded := True;
end;

procedure InitializeWizard();
var
  TopPosition: Integer;
begin
  ConfigurationPage := CreateCustomPage(wpSelectDir, 'Configure Mobile LM Studio', 'Choose the settings the installer will write into the service configuration.');

  TopPosition := 0;

  PortLabel := TNewStaticText.Create(ConfigurationPage);
  PortLabel.Parent := ConfigurationPage.Surface;
  PortLabel.Left := 0;
  PortLabel.Top := TopPosition;
  PortLabel.Caption := 'Web UI port';

  PortEdit := TNewEdit.Create(ConfigurationPage);
  PortEdit.Parent := ConfigurationPage.Surface;
  PortEdit.Left := 0;
  PortEdit.Top := PortLabel.Top + PortLabel.Height + ScaleY(4);
  PortEdit.Width := ScaleX(96);
  PortEdit.Text := '5080';

  TopPosition := PortEdit.Top + PortEdit.Height + ScaleY(8);

  DataPathLabel := TNewStaticText.Create(ConfigurationPage);
  DataPathLabel.Parent := ConfigurationPage.Surface;
  DataPathLabel.Left := 0;
  DataPathLabel.Top := TopPosition;
  DataPathLabel.Caption := 'Data file location';

  DataPathEdit := TNewEdit.Create(ConfigurationPage);
  DataPathEdit.Parent := ConfigurationPage.Surface;
  DataPathEdit.Left := 0;
  DataPathEdit.Top := DataPathLabel.Top + DataPathLabel.Height + ScaleY(4);
  DataPathEdit.Width := ConfigurationPage.SurfaceWidth;
  DataPathEdit.Text := ExpandConstant('{commonappdata}\MobileLmStudio\mobile-lm-studio.db');

  TopPosition := DataPathEdit.Top + DataPathEdit.Height + ScaleY(8);

  LmStudioUrlLabel := TNewStaticText.Create(ConfigurationPage);
  LmStudioUrlLabel.Parent := ConfigurationPage.Surface;
  LmStudioUrlLabel.Left := 0;
  LmStudioUrlLabel.Top := TopPosition;
  LmStudioUrlLabel.Caption := 'LM Studio server address';

  LmStudioUrlEdit := TNewEdit.Create(ConfigurationPage);
  LmStudioUrlEdit.Parent := ConfigurationPage.Surface;
  LmStudioUrlEdit.Left := 0;
  LmStudioUrlEdit.Top := LmStudioUrlLabel.Top + LmStudioUrlLabel.Height + ScaleY(4);
  LmStudioUrlEdit.Width := ConfigurationPage.SurfaceWidth;
  LmStudioUrlEdit.Text := 'http://127.0.0.1:1234';

  TopPosition := LmStudioUrlEdit.Top + LmStudioUrlEdit.Height + ScaleY(8);

  ApiKeyLabel := TNewStaticText.Create(ConfigurationPage);
  ApiKeyLabel.Parent := ConfigurationPage.Surface;
  ApiKeyLabel.Left := 0;
  ApiKeyLabel.Top := TopPosition;
  ApiKeyLabel.Caption := 'LM Studio server API key';

  ApiKeyEdit := TNewEdit.Create(ConfigurationPage);
  ApiKeyEdit.Parent := ConfigurationPage.Surface;
  ApiKeyEdit.Left := 0;
  ApiKeyEdit.Top := ApiKeyLabel.Top + ApiKeyLabel.Height + ScaleY(4);
  ApiKeyEdit.Width := ConfigurationPage.SurfaceWidth;
  ApiKeyEdit.PasswordChar := '*';

  TopPosition := ApiKeyEdit.Top + ApiKeyEdit.Height + ScaleY(8);

  McpConfigPathLabel := TNewStaticText.Create(ConfigurationPage);
  McpConfigPathLabel.Parent := ConfigurationPage.Surface;
  McpConfigPathLabel.Left := 0;
  McpConfigPathLabel.Top := TopPosition;
  McpConfigPathLabel.Caption := 'Optional MCP config path';

  McpConfigPathEdit := TNewEdit.Create(ConfigurationPage);
  McpConfigPathEdit.Parent := ConfigurationPage.Surface;
  McpConfigPathEdit.Left := 0;
  McpConfigPathEdit.Top := McpConfigPathLabel.Top + McpConfigPathLabel.Height + ScaleY(4);
  McpConfigPathEdit.Width := ConfigurationPage.SurfaceWidth;

  TopPosition := McpConfigPathEdit.Top + McpConfigPathEdit.Height + ScaleY(8);

  EnablePinCheckBox := TNewCheckBox.Create(ConfigurationPage);
  EnablePinCheckBox.Parent := ConfigurationPage.Surface;
  EnablePinCheckBox.Left := 0;
  EnablePinCheckBox.Top := TopPosition;
  EnablePinCheckBox.Width := ConfigurationPage.SurfaceWidth;
  EnablePinCheckBox.Caption := 'Require sign-in with a PIN';
  EnablePinCheckBox.OnClick := @UpdatePinState;

  TopPosition := EnablePinCheckBox.Top + EnablePinCheckBox.Height + ScaleY(8);

  PinLabel := TNewStaticText.Create(ConfigurationPage);
  PinLabel.Parent := ConfigurationPage.Surface;
  PinLabel.Left := 0;
  PinLabel.Top := TopPosition;
  PinLabel.Caption := 'Sign-in PIN';

  PinEdit := TNewEdit.Create(ConfigurationPage);
  PinEdit.Parent := ConfigurationPage.Surface;
  PinEdit.Left := 0;
  PinEdit.Top := PinLabel.Top + PinLabel.Height + ScaleY(4);
  PinEdit.Width := ConfigurationPage.SurfaceWidth;
  PinEdit.PasswordChar := '*';

  SuccessLinkLabel := TNewStaticText.Create(WizardForm);
  SuccessLinkLabel.Parent := WizardForm.FinishedLabel.Parent;
  SuccessLinkLabel.Left := WizardForm.FinishedLabel.Left;
  SuccessLinkLabel.Top := WizardForm.FinishedLabel.Top + WizardForm.FinishedLabel.Height + ScaleY(8);
  SuccessLinkLabel.Cursor := crHand;
  SuccessLinkLabel.Font.Style := [fsUnderline];
  SuccessLinkLabel.Font.Color := clBlue;
  SuccessLinkLabel.Visible := False;
  SuccessLinkLabel.OnClick := @SuccessLinkClick;

  UpdatePinState(nil);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  PortNumber: Integer;
  DataPath: string;
  McpConfigPath: string;
begin
  Result := True;

  if CurPageID <> ConfigurationPage.ID then
    Exit;

  PortNumber := StrToIntDef(Trim(PortEdit.Text), 0);
  if (PortNumber < 1) or (PortNumber > 65535) then
  begin
    MsgBox('Enter a web UI port between 1 and 65535.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  DataPath := Trim(DataPathEdit.Text);
  if DataPath = '' then
  begin
    MsgBox('Enter the full file path where Mobile LM Studio should store its data.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if (DataPath[Length(DataPath)] = '\') or (DataPath[Length(DataPath)] = '/') then
  begin
    MsgBox('Data file location must point to a file, not just a folder.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if not IsHttpUrl(LmStudioUrlEdit.Text) then
  begin
    MsgBox('Enter an LM Studio server address that starts with http:// or https://.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  McpConfigPath := Trim(McpConfigPathEdit.Text);
  if (McpConfigPath <> '') and ((McpConfigPath[Length(McpConfigPath)] = '\') or (McpConfigPath[Length(McpConfigPath)] = '/')) then
  begin
    MsgBox('MCP config path must point to a file when provided.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if EnablePinCheckBox.Checked and (Trim(PinEdit.Text) = '') then
  begin
    MsgBox('Enter a PIN or clear the sign-in checkbox to make sign-in optional.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): string;
begin
  InstallSucceeded := False;
  LocalUrl := GetLocalUrl();
  InstallSettingsPath := ExpandConstant('{tmp}\mobile-lm-studio-install-settings.json');

  if not SaveStringToFile(InstallSettingsPath, BuildInstallSettingsJson(), False) then
    Result := 'Setup could not write the temporary configuration file needed to finish installation.'
  else
    Result := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    RunServiceInstall;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID <> wpFinished then
    Exit;

  if InstallSucceeded then
  begin
    WizardForm.FinishedLabel.Caption := 'Installation completed successfully. Open the Mobile LM Studio web UI at:';
    SuccessLinkLabel.Caption := LocalUrl;
    SuccessLinkLabel.Visible := True;
  end
  else
  begin
    SuccessLinkLabel.Visible := False;
  end;
end;

procedure DeinitializeSetup();
begin
  if (InstallSettingsPath <> '') and FileExists(InstallSettingsPath) then
    DeleteFile(InstallSettingsPath);

  if (InstallFailurePath <> '') and FileExists(InstallFailurePath) then
    DeleteFile(InstallFailurePath);
end;