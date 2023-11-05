{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
    let 
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShell = with pkgs; mkShell rec {
        buildInputs = [
          ffmpeg
          python3
          nodePackages_latest.pnpm
          git
          nodejs
          protobuf
          unixtools.xxd
        ];
      };
    });
}
